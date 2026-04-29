export const config = {
  runtime: 'edge',
  // 東京リージョンでレイテンシ最適化
  regions: ['hnd1'],
};

// ─── 設定 ────────────────────────────────────────────────────────────────────
// 本番URLは環境変数で上書き可能
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  'http://localhost:5173',
  'http://localhost:4173',
];
// ALLOW_VERCEL_PREVIEW=true でプレビューデプロイ(hazumi-*.vercel.app)を許可
const ALLOW_VERCEL_PREVIEW = process.env.ALLOW_VERCEL_PREVIEW === 'true';
const VERCEL_PREVIEW_RE = /^https:\/\/hazumi-[\w-]+\.vercel\.app$/;

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (ALLOW_VERCEL_PREVIEW && VERCEL_PREVIEW_RE.test(origin)) return true;
  return false;
}

// モデルとmax_tokensは強制上書き(クライアント指定を信用しない)
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
]);
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS_LIMIT = 2500;
const MAX_REQUEST_BYTES = 50_000; // ~50KB
const MAX_SYSTEM_LENGTH = 8000;   // system prompt 上限
const MAX_MESSAGE_LENGTH = 4000;  // 1メッセージあたり上限
const MAX_MESSAGES_COUNT = 30;    // 会話履歴の上限

// レート制限: IP単位 / モード別
const RATE_LIMIT_PER_MINUTE = 15;  // 1分あたり
const RATE_LIMIT_PER_DAY = 200;    // 1日あたり
const RATE_WINDOW_MS = 60_000;

// インメモリレート制限(Edge Functionはインスタンス単位で独立するため厳密ではないが、
// 同一インスタンス内の連打を抑えるだけでも悪用を大幅に減らせる)
const rateMap = new Map();

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function getClientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { minuteCount: 0, minuteStart: now, dayCount: 0, dayStart: now };

  // 1分ウィンドウのリセット
  if (now - entry.minuteStart > RATE_WINDOW_MS) {
    entry.minuteCount = 0;
    entry.minuteStart = now;
  }
  // 1日ウィンドウのリセット
  if (now - entry.dayStart > 24 * 60 * 60 * 1000) {
    entry.dayCount = 0;
    entry.dayStart = now;
  }

  entry.minuteCount += 1;
  entry.dayCount += 1;
  rateMap.set(ip, entry);

  // Mapのサイズ暴走を防ぐ簡易GC
  if (rateMap.size > 10_000) {
    const cutoff = now - 24 * 60 * 60 * 1000;
    for (const [k, v] of rateMap) {
      if (v.dayStart < cutoff) rateMap.delete(k);
    }
  }

  if (entry.minuteCount > RATE_LIMIT_PER_MINUTE) {
    return { ok: false, reason: 'rate_limit_minute', retryAfter: 60 };
  }
  if (entry.dayCount > RATE_LIMIT_PER_DAY) {
    return { ok: false, reason: 'rate_limit_day', retryAfter: 3600 };
  }
  return { ok: true };
}

function corsHeaders(origin) {
  const allowed = isOriginAllowed(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      ...extraHeaders,
    },
  });
}

// リクエストボディのバリデーションとサニタイズ
function sanitizeBody(raw) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Invalid body' };
  }

  // model は強制上書き(許可リスト外は拒否)
  const model = ALLOWED_MODELS.has(raw.model) ? raw.model : DEFAULT_MODEL;

  // max_tokens は上限でクリップ
  const maxTokens = Math.min(
    Math.max(parseInt(raw.max_tokens) || 1000, 100),
    MAX_TOKENS_LIMIT
  );

  // system prompt 長さ制限
  let system = '';
  if (typeof raw.system === 'string') {
    system = raw.system.slice(0, MAX_SYSTEM_LENGTH);
  }

  // messages の検証
  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    return { error: 'messages must be a non-empty array' };
  }
  if (raw.messages.length > MAX_MESSAGES_COUNT) {
    return { error: `messages exceeds max count (${MAX_MESSAGES_COUNT})` };
  }

  const messages = [];
  for (const m of raw.messages) {
    if (!m || typeof m !== 'object') continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.content !== 'string') continue;
    messages.push({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    });
  }
  if (messages.length === 0) {
    return { error: 'No valid messages' };
  }

  return {
    body: {
      model,
      max_tokens: maxTokens,
      system,
      messages,
    },
  };
}

// ─── メインハンドラ ──────────────────────────────────────────────────────────
export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, headers);
  }

  // Content-Type 検証
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: 'Content-Type must be application/json' }, 415, headers);
  }

  // 1. Origin検証(本番で未許可のドメインからのアクセスは拒否)
  //    localhostでのテスト時や、同一ドメインのSSR時はOriginヘッダが空になる場合があるため、
  //    空Originは許可(ただし本番では必ずOriginが付くブラウザ経由のみを想定)
  if (origin && !isOriginAllowed(origin)) {
    return jsonResponse({ error: 'Forbidden origin' }, 403, headers);
  }

  // 2. リクエストサイズ制限
  const contentLength = parseInt(req.headers.get('content-length') || '0');
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: 'Request too large' }, 413, headers);
  }

  // 3. レート制限
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return jsonResponse(
      { error: 'Rate limit exceeded', reason: rate.reason },
      429,
      { ...headers, 'Retry-After': String(rate.retryAfter) }
    );
  }

  // 4. ボディパース(実際のボディサイズも制限)
  let raw;
  try {
    const bodyText = await req.text();
    if (bodyText.length > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'Request too large' }, 413, headers);
    }
    raw = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, headers);
  }

  // 5. サニタイズ
  const { body, error } = sanitizeBody(raw);
  if (error) {
    return jsonResponse({ error }, 400, headers);
  }

  // 6. APIキーの存在確認
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude-proxy] ANTHROPIC_API_KEY is not set');
    return jsonResponse({ error: 'Server misconfiguration' }, 500, headers);
  }

  // 7. Anthropic APIへ中継(タイムアウト付き)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await upstream.json();

    // Anthropic側のエラーはそのまま返すが、status codeは維持
    return jsonResponse(data, upstream.status, headers);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return jsonResponse({ error: 'Upstream timeout' }, 504, headers);
    }
    console.error('[claude-proxy] Upstream error:', err);
    return jsonResponse({ error: 'Upstream error' }, 502, headers);
  }
}