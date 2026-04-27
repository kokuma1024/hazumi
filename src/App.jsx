import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const API_ENDPOINT = "/api/claude";

const uniqueId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

// ─── API共通ラッパー ──────────────────────────────────────────────────────────
async function callClaudeApi(payload) {
  let res;
  try {
    res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("ネットワークエラーが発生しました。接続を確認してください。");
  }
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "0");
    let when;
    if (retryAfter >= 3600) when = `${Math.round(retryAfter / 3600)}時間後に`;
    else if (retryAfter >= 60) when = `${Math.round(retryAfter / 60)}分後に`;
    else if (retryAfter > 0) when = `${retryAfter}秒後に`;
    else when = "しばらく後に";
    throw new Error(`リクエストが多すぎます。${when}もう一度お試しください。`);
  }
  if (res.status === 403) {
    throw new Error("アクセスが拒否されました（403）。");
  }
  if (!res.ok) {
    throw new Error(`サーバーエラーが発生しました（${res.status}）。しばらく後にお試しください。`);
  }
  return res.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRO_LOADING_MSGS = [
  "状況を分析中…",
  "クライシス視点を確認中…",
  "リスクを評価中…",
  "最適なロールを選別中…",
  "アクションを組み立て中…",
];

const VISION_LOADING_MSGS = [
  "プロファイルを参照中…",
  "あなたの軸から判断中…",
  "最善手を探している…",
  "タスクを構成中…",
];

const PRO_FOLLOW_UPS = ["次のステップは?", "別の視点で見ると?", "優先順位を整理して", "もっと具体的に教えて", "今日中にやるべきことは?"];
const VISION_FOLLOW_UPS = ["次に取り組むことは?", "軌道修正するには?", "今日の最優先は?", "もっとシンプルにするには?"];

const PRO_ROLES = [
  { id: "crisis",   name: "クライシス",   en: "Crisis Manager",     emoji: "🚨", color: "#dc2626", desc: "人命・法的リスク・重大損失を避けるための最短初動" },
  { id: "risk",     name: "リスク",       en: "Risk Manager",       emoji: "🛡", color: "#d97706", desc: "証跡確保・コンプライアンス・安全性重視の手順" },
  { id: "exec",     name: "エグゼクティブ", en: "Executive",         emoji: "📊", color: "#2563eb", desc: "時間・コスト・ROIを最大化する組織的判断" },
  { id: "cs",       name: "CS",           en: "Customer Success",   emoji: "🤝", color: "#059669", desc: "依頼主・後工程の負担を先回りして解消する立ち回り" },
  { id: "architect",name: "アーキテクト", en: "Architect",          emoji: "🏗", color: "#7c3aed", desc: "再利用性・仕組み化を視野に入れた根本的な工程" },
  { id: "specialist",name: "スペシャリスト", en: "Specialist",      emoji: "🔬", color: "#0891b2", desc: "専門的完成度・論理的整合性を担保する緻密な検証" },
  { id: "mentor",   name: "メンター",     en: "Mentor",             emoji: "🧘", color: "#db2777", desc: "メンタル維持・冷静さを取り戻すための内省タスク" },
];

const STORAGE_KEY = "hazumi_v1"; // キー変更で古いlocalStorageデータをリセット
// チャット履歴からテキストサマリーを生成
const buildHistorySummary = (messages) => {
  return messages
    .filter(m => m.type === "user" || m.type === "vision" || m.type === "pro")
    .map(m => {
      if (m.type === "user") return { role: "user", text: m.text };
      if (m.type === "vision") return { role: "ai", text: m.result?.action || "" };
      if (m.type === "pro") return { role: "ai", text: (m.cards || []).map(c => c.action).join(" / ") };
      return null;
    })
    .filter(Boolean);
};

const fmtTime = () => {
  const d = new Date();
  return (d.getMonth()+1) + "/" + String(d.getDate()).padStart(2,"0") + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
};

const fmtDate = () => {
  const d = new Date();
  return d.getFullYear() + " " + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0") + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + " 提案";
};
const loadState  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; } };
const saveState  = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };
const fmt = (sec) => { const m = Math.floor(Math.abs(sec) / 60); const s = Math.abs(sec) % 60; return `${m}:${String(s).padStart(2, "0")}`; };

// ─── Alert ────────────────────────────────────────────────────────────────────
function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.2, 0.4].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(660, ctx.currentTime + t);
      o.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + t + 0.15);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.19);
    });
  } catch {}
}

// ─── API: プロモード(並列ロール自動選別) ────────────────────────────────────
async function callProMode(userText, conversationHistory) {
  // 会話履歴から過去に提案済みのロールを抽出
  const pastRoles = conversationHistory
    .filter(m => m.role === "assistant")
    .flatMap(m => { try { const p = JSON.parse(m.content); if (Array.isArray(p)) return p.map(c => c.role); if (p.tasks && Array.isArray(p.tasks)) return p.tasks.map(c => c.role); return []; } catch { return []; } });
  const mentorCount = pastRoles.filter(r => r === "mentor").length;
  const uniquePast = [...new Set(pastRoles)];
  const pastRolesLine = uniquePast.length > 0 ? "\n[過去に提案済みのロール]: " + uniquePast.join(", ") : "";
  const mentorLine = mentorCount >= 2
    ? "\n[参考] mentorはすでに" + mentorCount + "回提案済みです。ユーザーが落ち着いてきた様子であれば、今回は解決系ロール(crisis/risk/exec/cs/architect/specialist)を優先してください。ただし心理的動揺が続いているなら引き続きmentorを含めてください。"
    : "";

  const systemBody = [
    "あなたはHAZUMI(行動支援AIコーチ)です。ユーザーの課題と会話の流れを分析し、7つのロールから今この瞬間に最適な2〜4つを選別して即実行可能なアクションを提案してください。",
    pastRolesLine,
    mentorLine,
    "",
    "ロール定義:",
    "- crisis: クライシスマネージャー。人命・法的リスク・重大損失回避の最短初動",
    "- risk: リスクマネージャー。証跡確保・コンプライアンス・安全性重視の手順",
    "- exec: エグゼクティブ。時間・コスト・ROI最大化の組織的判断",
    "- cs: カスタマーサクセス。依頼主・後工程の負担を先回りして解消",
    "- architect: アーキテクト。再利用性・仕組み化を視野に入れた根本的工程",
    "- specialist: スペシャリスト。専門的完成度・論理的整合性の緻密な検証",
    "- mentor: メンター。心理的動揺・パニック時に冷静さを取り戻す内省タスク(多用禁止)",
    "",
    "選別ルール:",
    "- 状況・感情・フェーズに応じて最適なロールを選ぶ。文脈に合わないロールは省略",
    "- ミス・事故・トラブル・動揺 → crisis/risk/mentorを優先",
    "- 心理的動揺・焦りが読み取れる → mentorを含める",
    "- 会話が進み落ち着いてきた・具体的な手順を聞いている → exec/cs/architect/specialistを優先",
    "- 緊急・損害系 → crisis/risk",
    "- 企画・戦略系 → exec/architect",
    "- 技術・制作系 → specialist/architect",
    "- 対人・顧客系 → cs/exec",
    "- 過去に同じロールが続いている場合は別のロールも検討する(ただし状況に合えば継続してよい)",
    "",
    "- 各actionは動詞始まりの1行(句点なし)",
    "- minutesは整数(最低1)",
    "- 必ずJSONのみ返す。説明文・マークダウン不要",
  ].join("\n");
  const systemFormat = [
    "",
    "出力フォーマットはJSONオブジェクト1つ(配列ではない):",
    "{",
    '  "roadmap": "状況解決に向けた簡潔なロードマップ(2〜4ステップを矢印でつなぐ。例: 初動対応 → 証跡確保 → 上司報告 → 再発防止)",',
    '  "summary": "今この状況でなぜこれらのタスクが必要かを1〜2文で説明",',
    '  "tasks": [{"role":"crisis","priority":"高","action":"〇〇する","minutes":3,"reason":"理由1文","tools":"必要なもの","goal":"最終的な状態1文","tips":"攻略ポイント・コツを1〜2文","next":"次の方向性(省略可)","steps":[{"action":"まず〇〇を用意する","seconds":15},{"action":"〇〇を書き出す","seconds":120},{"action":"〇〇する","seconds":60}]}]',
    "}",
    '- priorityは "高"/"中"/"低" のいずれか',
    "- toolsは実行に必要な道具・環境・アプリを簡潔に記載。不要な場合はなしと記載",
    "- goalは完遂した先の具体的なゴールを1文で",
    "- tipsはこのタスクをうまく進めるためのコツ・注意点・効率化のヒントを1〜2文で",
    "- stepsは必ず2要素の配列: [助走, メインタスク]",
    "- stepsの1番目: 誰でも即できる準備アクション(seconds:10〜30)例:「ノートとペンを用意する」「アプリを開く」「メモ帳に件名だけ書く」",
    "- stepsの2番目: メインタスクそのもの(seconds: minutes×60)",
    "- secondsは整数(秒数)",
    '- tasksはpriority "高"→"中"→"低" の順で並べること',
    "- JSONのみ出力。説明文・マークダウン不要",
  ].join("\n");
  const system = systemBody + systemFormat;

  const data = await callClaudeApi({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system,
    messages: [...conversationHistory, { role: "user", content: userText }],
  });
  const text = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(text);
    // 新フォーマット: {roadmap, summary, tasks:[]}
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return { roadmap: parsed.roadmap || "", summary: parsed.summary || "", tasks: parsed.tasks };
    }
    // 旧フォーマット互換: 配列
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return { roadmap: "", summary: "", tasks: arr };
  } catch {
    return { roadmap: "", summary: "", tasks: [{ role: "exec", action: "状況を整理してメモに書き出す", minutes: 5, reason: "まず頭の中を整理することが最優先です" }] };
  }
}

// ─── API: ビジョンモード(プロファイルベース1提案) ─────────────────────────
async function callVisionMode(userText, profile, conversationHistory) {
  const system = `あなたは「${profile.name || "理想の自分"}」というロールのタスクコーチです。

プロファイル:
${profile.description || "(未設定)"}

このプロファイルが持つ美学・中長期的な目標・価値観に沿って、ユーザーの課題に対し今すぐ実行できる最善手を1つだけ提案してください。

ルール:
- actionは動詞始まりの1行(句点なし)
- minutesは整数(最低1)
- 必ずJSONのみ返す

{"action":"〇〇する","minutes":5,"reason":"理由1文","tools":"必要なもの(例: ノート、PC)","goal":"このタスクをこなすと最終的にどうなるか1文","tips":"攻略ポイント・コツを1〜2文","next":"次の方向性(省略可)"}
- toolsは実行に必要な道具・環境・アプリを簡潔に記載。不要なら"なし"
- goalは「〜の状態になる」「〜が解決する」など、このタスクを完遂した先の具体的なゴールを1文で記載
- tipsはこのタスクをうまく進めるためのコツ・注意点・効率化のヒントを1〜2文で記載`;

  const data = await callClaudeApi({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system,
    messages: [...conversationHistory, { role: "user", content: userText }],
  });
  const text = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
  try { return JSON.parse(text); }
  catch { return { action: "状況をノートに書き出して俯瞰する", minutes: 5, reason: "自分の軸に立ち返ることが先決です", next: "" }; }
}

// ─── ステップタイマーフック ──────────────────────────────────────────────────────
// steps: [{action, seconds}] を順番に自動進行するタイマー
function useStepTimer(steps, onAllComplete) {
  const [stepIdx, setStepIdx] = useState(-1);   // -1: 未開始
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);

  const currentStep = steps?.[stepIdx] || null;
  const currentSec  = currentStep?.seconds || 60;
  const remaining   = currentSec - elapsed;
  const isOver      = remaining < 0;
  const progress    = Math.min(elapsed / currentSec, 1);

  const startStep = useCallback((idx, offsetSec = 0) => {
    cancelAnimationFrame(rafRef.current);
    firedRef.current = offsetSec > (steps[idx]?.seconds || 60);
    setStepIdx(idx);
    setElapsed(offsetSec);
    startRef.current = Date.now() - offsetSec * 1000;
    const tick = () => {
      const n = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(n);
      if (n > (steps[idx]?.seconds || 60) && !firedRef.current) {
        firedRef.current = true;
        playAlert();
        setFlash(true);
        setTimeout(() => setFlash(false), 800);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [steps]);

  const resumeAt = useCallback((idx, offsetSec = 0) => startStep(idx, offsetSec), [startStep]);

  const nextStep = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const next = stepIdx + 1;
    if (next < (steps?.length || 0)) {
      startStep(next);
    } else {
      setStepIdx(-2);
      onAllComplete?.(elapsed);
    }
  }, [stepIdx, steps, elapsed, startStep, onAllComplete]);

  const startCurrentStep = useCallback(() => { startStep(stepIdx); }, [stepIdx, startStep]);

  const stop = useCallback(() => { cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return {
    stepIdx, currentStep, elapsed, remaining, isOver, progress, flash,
    started: stepIdx >= 0,
    done: stepIdx === -2,
    start: () => startStep(0),
    resumeAt, nextStep, startCurrentStep, stop,
    totalSteps: steps?.length || 0,
  };
}

// ─── タイマーフック ────────────────────────────────────────────────────────────
// カウントダウン方式: remaining = estimatedSec - elapsed (0を下回ると超過)
function useTimer(onOver) {
  const [phase, setPhase]     = useState("idle");
  const [elapsed, setElapsed] = useState(0);   // 経過秒(内部計算用)
  const [flash, setFlash]     = useState(false);
  const startRef = useRef(null);
  const rafRef   = useRef(null);
  const firedRef = useRef(false);
  const estRef   = useRef(0);

  const start = useCallback((estimatedSec, offsetSec = 0) => {
    firedRef.current = offsetSec > estimatedSec; // 既に超過済みならアラート不要
    estRef.current   = estimatedSec;
    setElapsed(offsetSec);
    setPhase("running");
    startRef.current = Date.now() - offsetSec * 1000;
    const tick = () => {
      const n = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(n);
      if (n > estimatedSec && !firedRef.current) {
        firedRef.current = true;
        playAlert();
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
        onOver?.();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // remaining: 0以下になると超過
  const remaining = (estRef.current || 0) - elapsed;

  return { phase, setPhase, elapsed, remaining, flash, start, stop };
}

// ─── SingleActionCard(ビジョン用・従来と同じ1提案) ─────────────────────────
function SingleActionCard({ result, accentColor, onDone, onPend, onRetry }) {
  const estimatedSec = Math.max((result.minutes || 5) * 60, 60);
  const { phase, setPhase, elapsed, remaining, flash, start, stop } = useTimer();
  const [supplement, setSupplement] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const isOver = remaining < 0;
  const progress = Math.min(elapsed / estimatedSec, 1);
  const hasDetail = result.goal || (result.tools && result.tools !== "なし") || result.reason;

  const handleDone = (note = "") => { stop(); setPhase("done"); onDone(elapsed, result, note); };
  const handlePend = () => { stop(); setPhase("pended"); onPend(elapsed); };

  return (
    <div style={{ ...S.card, outline: flash ? `2px solid ${accentColor}` : "none" }}>
      <div style={S.cardAction}>{result.action}</div>

      {phase === "idle" && (
        <>
          <div style={S.metaRow}>
            <span style={{ ...S.minPill, background: accentColor + "18", color: accentColor }}>⏱ {result.minutes}分</span>
            {result.reason && <span style={S.reasonTxt}>{result.reason}</span>}
          </div>
          {result.goal && (
            <div style={S.goalRow}>
              <span style={S.goalIcon}>🎯</span>
              <span style={S.goalTxt}>{result.goal}</span>
            </div>
          )}
          {result.tips && (
            <div style={S.tipsRow}>
              <span style={S.tipsIcon}>💡</span>
              <span style={S.tipsTxt}>{result.tips}</span>
            </div>
          )}
          {result.tools && result.tools !== "なし" && (
            <div style={S.toolsRow}>
              <span style={S.toolsIcon}>🧰</span>
              <span style={S.toolsTxt}>{result.tools}</span>
            </div>
          )}
          {result.next && <div style={S.nextTxt}>→ {result.next}</div>}
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }} onClick={() => start(estimatedSec)}>▶ 始める</button>
            <button style={S.pendBtnLg} onClick={() => { setPhase("pended"); onPend(0); }}>⏸ 保留</button>
          </div>
          <button style={S.retryBtnFull} onClick={onRetry}>🔄 別の案を出す</button>
        </>
      )}

      {phase === "running" && (
        <>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(1 - progress) * 100}%`, background: isOver ? "#ef4444" : accentColor }} />
          </div>
          <div style={S.timerDisplay}>
            <div style={S.timerHalf}>
              <span style={{ ...S.timerBig, fontSize: 30, color: isOver ? "#ef4444" : "#1e293b" }}>
                {isOver ? `+${fmt(-remaining)}` : fmt(remaining)}
              </span>
              <span style={S.timerSub}>{isOver ? "超過中" : "残り"}</span>
            </div>
            <div style={S.timerDivider} />
            <div style={{ ...S.timerHalf, alignItems: "flex-end" }}>
              <span style={{ ...S.timerBig, fontSize: 30, color: "#94a3b8" }}>{fmt(elapsed)}</span>
              <span style={S.timerSub}>経過</span>
            </div>
          </div>

          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {result.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{result.goal}</span></div>}
                  {result.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{result.tips}</span></div>}
                  {result.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{result.reason}</span></div>}
                  {result.tools && result.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{result.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }} onClick={handleDone}>✓ できた</button>
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
          <button style={S.supplementBtn} onClick={() => setPhase("supplement")}>
            ＋ 補足して完了
          </button>
        </>
      )}

      {phase === "supplement" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.6 }}>
            完了の補足を入力してください(例: やろうとしたけど別の問題が発生した、半分しかできなかった)
          </div>
          <textarea
            style={{ ...S.supplementArea }}
            placeholder="補足内容を入力…"
            rows={3}
            autoFocus
            value={supplement}
            onChange={e => setSupplement(e.target.value)}
          />
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }}
              onClick={() => { stop(); handleDone(supplement); }}>
              この内容で完了
            </button>
            <button style={S.ghostBtn} onClick={() => setPhase("running")}>戻る</button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={S.resolvedRow}>
          <span style={{ color: accentColor, fontWeight: 700, fontSize: 13 }}>✓ 完了</span>
          <span style={S.resolvedSub}>実測 {elapsed > 0 ? fmt(elapsed) : "—"} / 予想 {result.minutes}分
            {elapsed > 0 && <span style={{ color: isOver ? "#ef4444" : "#64748b", marginLeft: 4 }}>{isOver ? `(+${fmt(-remaining)})` : `(-${fmt(remaining)})`}</span>}
          </span>
        </div>
      )}
      {phase === "pended" && (
        <div style={{ marginTop: 6 }}>
          <div style={{ ...S.resolvedRow, marginBottom: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>⏸ 保留中</span>
            {elapsed > 0 && <span style={S.resolvedSub}>中断時点 {fmt(elapsed)}</span>}
          </div>
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {result.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{result.goal}</span></div>}
                  {result.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{result.tips}</span></div>}
                  {result.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{result.reason}</span></div>}
                  {result.tools && result.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{result.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button style={{ ...S.primaryBtn, background: accentColor, width:"100%" }}
              onClick={() => { setPhase("running"); start(estimatedSec, elapsed); }}>
              ▶ 続きから再開({fmt(elapsed)} 経過)
            </button>
            <button style={{ ...S.primaryBtn, background: "#94a3b8", width:"100%" }}
              onClick={() => { setPhase("running"); start(estimatedSec, 0); }}>
              ■ 始めから開始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProRoleCard(プロモード各ロールのカード) ────────────────────────────────
function ProRoleCard({ item, collapsed, compact, onDone, onPend, onStart }) {
  const roleDef = PRO_ROLES.find(r => r.id === item.role) || PRO_ROLES[2];
  const estimatedSec = Math.max((item.minutes || 5) * 60, 60);
  const { phase, setPhase } = useTimer();
  const [supplement, setSupplement] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [pendedStepIdx, setPendedStepIdx] = useState(0);
  const [pendedElapsed, setPendedElapsed] = useState(0);
  const hasDetail = item.goal || (item.tools && item.tools !== "なし") || item.reason;

  const steps = item.steps?.length > 0 ? item.steps : [{ action: item.action, seconds: estimatedSec }];
  const stepTimer = useStepTimer(steps, (totalElapsed) => {
    setPhase("done");
    onDone(item.role, totalElapsed, item, "");
  });

  const flash = stepTimer.flash;
  const handleStart = () => { onStart(); setPhase("running"); stepTimer.start(); };
  const handleDone  = (note = "") => { stepTimer.stop(); setPhase("done"); onDone(item.role, stepTimer.elapsed, item, note); };
  const handlePend  = () => {
    const si = stepTimer.stepIdx >= 0 ? stepTimer.stepIdx : 0;
    const el = stepTimer.elapsed;
    stepTimer.stop();
    setPendedStepIdx(si);
    setPendedElapsed(el);
    setPhase("pended");
    onPend(item, el, si);
  };

  // コンパクトモード: ヘッダー固定、詳細をmax-heightでトグル
  if (compact && phase === "idle") {
    return (
      <div style={{ ...S.proCard, borderLeftColor: roleDef.color, overflow: "hidden" }}>
        {/* ヘッダー(常に表示) */}
        <div style={{ cursor: "pointer" }} onClick={() => setCompactExpanded(v => !v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {item.priority && (
              <span style={{
                background: item.priority === "高" ? "#ef4444" : item.priority === "中" ? "#f59e0b" : "#94a3b8",
                color: "white", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 8px", flexShrink: 0,
              }}>{item.priority}</span>
            )}
            <span style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
              {roleDef.emoji} {roleDef.name}
              <span style={S.proRoleEn}>{roleDef.en}</span>
            </span>
            <span style={{ ...S.minPill, background: roleDef.color + "15", color: roleDef.color, marginLeft: "auto", flexShrink: 0 }}>⏱ {item.minutes}分</span>
          </div>
          <div style={S.proAction}>{item.action}</div>
          {/* 助走(コンパクト時も常に表示) */}
          {item.steps?.length > 0 && steps[0] && !compactExpanded && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
              <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4, flex: 1 }}>{steps[0].action}</span>
              <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
              </span>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginTop: 4 }}>
            {compactExpanded ? "▲ 閉じる" : "▼ 詳細を見る"}
          </div>
        </div>
        {/* 詳細(max-heightでアニメーション) */}
        <div style={{
          maxHeight: compactExpanded ? "600px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}>
          <div style={{ paddingTop: 12 }}>
            {item.goal && (
              <div style={S.goalRow}>
                <span style={S.goalIcon}>🎯</span>
                <span style={S.goalTxt}>{item.goal}</span>
              </div>
            )}
            {item.tips && (
              <div style={S.tipsRow}>
                <span style={S.tipsIcon}>💡</span>
                <span style={S.tipsTxt}>{item.tips}</span>
              </div>
            )}
            {item.tools && item.tools !== "なし" && (
              <div style={S.toolsRow}>
                <span style={S.toolsIcon}>🧰</span>
                <span style={S.toolsTxt}>{item.tools}</span>
              </div>
            )}
            {/* 助走:始めるボタン直上 */}
            {item.steps?.length > 0 && steps[0] && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: roleDef.color + "08", border: `1px solid ${roleDef.color}30`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1, lineHeight: 1.4 }}>{steps[0].action}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                  {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
                </span>
              </div>
            )}
            <div style={S.btnRow}>
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex: 2 }}
                onClick={e => { e.stopPropagation(); handleStart(); }}>▶ 始める</button>
              <button style={S.pendBtnLg}
                onClick={e => { e.stopPropagation(); handlePend(); }}>⏸ 保留</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 折りたたみ状態(他が実行中)
  if (collapsed && phase === "idle") {
    return (
      <div style={{ ...S.proCard, borderLeftColor: roleDef.color, opacity: 0.45 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
            {roleDef.emoji} {roleDef.name}
            <span style={S.proRoleEn}>{roleDef.en}</span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{item.minutes}分</span>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>{item.action}</div>
      </div>
    );
  }

  return (
    <div
      style={{ ...S.proCard, borderLeftColor: roleDef.color, outline: flash ? `2px solid ${roleDef.color}` : "none" }}

    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
          {item.priority && (
            <span style={{
              background: item.priority === "高" ? "#ef4444" : item.priority === "中" ? "#f59e0b" : "#94a3b8",
              color: "white", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 8px", marginRight: 4,
            }}>
              {item.priority}
            </span>
          )}
          {roleDef.emoji} {roleDef.name}
          <span style={S.proRoleEn}>{roleDef.en}</span>
        </div>
        <span style={{ ...S.minPill, background: roleDef.color + "15", color: roleDef.color, flexShrink: 0 }}>⏱ {item.minutes}分</span>
      </div>
      <div style={{
        ...S.proAction,
        ...(phase === "running" ? { fontSize: 12, color: "#94a3b8", fontWeight: 500, marginBottom: 6 } : {}),
      }}>{item.action}</div>

      {phase === "idle" && (
        <>
          {compact && compactExpanded && (
            <div style={{ fontSize: 10, color: "#cbd5e1", textAlign: "right", marginTop: -4, marginBottom: 6 }}>タップで閉じる</div>
          )}
          <div style={S.metaRow}>
            {item.reason && <span style={S.reasonTxt}>{item.reason}</span>}
          </div>
          {item.goal && (
            <div style={S.goalRow}>
              <span style={S.goalIcon}>🎯</span>
              <span style={S.goalTxt}>{item.goal}</span>
            </div>
          )}
          {item.tips && (
            <div style={S.tipsRow}>
              <span style={S.tipsIcon}>💡</span>
              <span style={S.tipsTxt}>{item.tips}</span>
            </div>
          )}
          {item.tools && item.tools !== "なし" && (
            <div style={S.toolsRow}>
              <span style={S.toolsIcon}>🧰</span>
              <span style={S.toolsTxt}>{item.tools}</span>
            </div>
          )}
          {/* 助走:始めるボタンの直上 */}
          {item.steps?.length > 0 && steps[0] && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: roleDef.color + "08", border: `1px solid ${roleDef.color}30`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1, lineHeight: 1.4 }}>{steps[0].action}</span>
              <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
              </span>
            </div>
          )}
          <div style={S.btnRow} onClick={e => e.stopPropagation()}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={handleStart}>▶ 始める</button>
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          {/* ステップ進捗ドット */}
          <div style={S.stepHeader}>
            {steps.map((_, i) => (
              <div key={i} style={{
                ...S.stepDot,
                background: i <= stepTimer.stepIdx ? roleDef.color : "#e2e8f0",
                opacity: i < stepTimer.stepIdx ? 0.4 : 1,
              }} />
            ))}
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>
              {stepTimer.stepIdx === 0 ? "助走" : "メインタスク"}
            </span>
          </div>

          {/* 現在のサブタスク名 */}
          <div style={S.stepAction}>{stepTimer.currentStep?.action}</div>

          {/* カウントダウンバー */}
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(1 - stepTimer.progress) * 100}%`, background: stepTimer.isOver ? "#ef4444" : roleDef.color }} />
          </div>

          {/* 時間表示 */}
          <div style={S.timerDisplay}>
            <div style={S.timerHalf}>
              <span style={{ ...S.timerBig, fontSize: 26, color: stepTimer.isOver ? "#ef4444" : "#1e293b" }}>
                {stepTimer.isOver ? `+${fmt(-stepTimer.remaining)}` : fmt(stepTimer.remaining)}
              </span>
              <span style={S.timerSub}>{stepTimer.isOver ? "超過中" : "残り"}</span>
            </div>
            <div style={S.timerDivider} />
            <div style={{ ...S.timerHalf, alignItems: "flex-end" }}>
              <span style={{ ...S.timerBig, fontSize: 26, color: "#94a3b8" }}>{fmt(stepTimer.elapsed)}</span>
              <span style={S.timerSub}>経過</span>
            </div>
          </div>

          {/* 詳細折りたたみ */}
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {item.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{item.goal}</span></div>}
                  {item.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{item.tips}</span></div>}
                  {item.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{item.reason}</span></div>}
                  {item.tools && item.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{item.tools}</span></div>}
                </div>
              )}
            </div>
          )}

          {/* ボタン */}
          <div style={S.btnRow} onClick={e => e.stopPropagation()}>
            {stepTimer.stepIdx < stepTimer.totalSteps - 1 ? (
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={stepTimer.nextStep}>
                ✓ 準備OK → メインタスクへ
              </button>
            ) : (
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={() => handleDone()}>
                ✓ タスク完了
              </button>
            )}
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
          <button style={S.supplementBtn} onClick={e => { e.stopPropagation(); setPhase("supplement"); }}>
            ＋ 補足して完了
          </button>
        </>
      )}

      {phase === "supplement" && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.6 }}>
            完了の補足を入力してください
          </div>
          <textarea
            style={{ ...S.supplementArea }}
            placeholder="補足内容を入力…"
            rows={3}
            autoFocus
            value={supplement}
            onChange={e => setSupplement(e.target.value)}
          />
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }}
              onClick={() => { stepTimer.stop(); handleDone(supplement); }}>
              この内容で完了
            </button>
            <button style={S.ghostBtn} onClick={() => setPhase("running")}>戻る</button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={S.resolvedRow}>
          <span style={{ color: roleDef.color, fontWeight: 700, fontSize: 13 }}>✓ 完了</span>
          <span style={S.resolvedSub}>実測 {fmt(stepTimer.elapsed)} / 予想 {item.minutes}分</span>
        </div>
      )}
      {phase === "pended" && (
        <div style={{ marginTop: 6 }}>
          <div style={{ ...S.resolvedRow, marginBottom: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>⏸ 保留中</span>
            {pendedElapsed > 0 && <span style={S.resolvedSub}>中断時点 {fmt(pendedElapsed)}({pendedStepIdx === 0 ? "助走" : "メインタスク"})</span>}
          </div>
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {item.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{item.goal}</span></div>}
                  {item.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{item.tips}</span></div>}
                  {item.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{item.reason}</span></div>}
                  {item.tools && item.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{item.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, width:"100%" }}
              onClick={() => { setPhase("running"); stepTimer.resumeAt(pendedStepIdx, pendedElapsed); }}>
              ▶ 続きから再開({fmt(pendedElapsed)} 経過)
            </button>
            <button style={{ ...S.primaryBtn, background: "#94a3b8", width:"100%" }}
              onClick={() => { setPhase("running"); stepTimer.start(); }}>
              ■ 始めから開始(助走から)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProResultGroup(プロモードの並列提案グループ) ──────────────────────────
function ProResultGroup({ group, onDone, onPend }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const [doneIdx, setDoneIdx] = useState(null);

  return (
    <div style={S.proGroup}>
      {/* ロードマップ・サマリー */}
      {(group.roadmap || group.summary) && (
        <div style={S.roadmapCard}>
          {group.roadmap && (
            <div style={S.roadmapRow}>
              <span style={S.roadmapLabel}>🗺 ロードマップ</span>
              <span style={S.roadmapText}>{group.roadmap}</span>
            </div>
          )}
          {group.summary && (
            <div style={S.summaryText}>{group.summary}</div>
          )}
        </div>
      )}
      <div style={S.proGroupLabel}>
        <span style={S.proGroupDot} />
        {group.cards.length}つの視点から提案 <span style={{ color: "#94a3b8", fontWeight: 400 }}>· 優先順位順</span>
        {activeIdx !== null && doneIdx === null && (
          <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 6 }}>— 他は折りたたみ中</span>
        )}
      </div>
      {group.cards.map((card, i) => (
        <ProRoleCard
          key={i}
          item={card}
          compact={group.cards.length > 1}
          collapsed={(activeIdx !== null && activeIdx !== i) || (doneIdx !== null && doneIdx !== i)}
          onStart={() => setActiveIdx(i)}
          onDone={(roleId, elapsed, card, note) => {
            setDoneIdx(i);
            setActiveIdx(null);
            onDone(roleId, elapsed, card, note);
          }}
          onPend={(c, elapsed, stepIdx) => { setActiveIdx(null); onPend(c, elapsed, stepIdx); }}
        />
      ))}
    </div>
  );
}
// ─── SampleProPreview(空状態の結果プレビュー) ────────────────────────────
function SampleProPreview() {
  const sample = {
    roadmap: "初動対応 → 証跡確保 → 関係者連携",
    summary: "影響を最小化するため、初動と記録を最優先で進めます",
    cards: [
      {
        role: "crisis", priority: "高",
        action: "影響範囲を3行でメモに書き出す",
        minutes: 3,
        firstStep: { action: "メモアプリを開く", seconds: 15 },
      },
      {
        role: "risk", priority: "中",
        action: "発生時刻と操作内容をスクショで残す",
        minutes: 5,
        firstStep: { action: "スクショの準備をする", seconds: 20 },
      },
      {
        role: "cs", priority: "中",
        action: "影響を受ける関係者を一覧化する",
        minutes: 5,
        firstStep: { action: "ノートに名前欄を作る", seconds: 15 },
      },
    ],
  };

  return (
    <div style={{ width: "100%", marginTop: 28, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingLeft: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: "white", background: "#94a3b8",
          borderRadius: 20, padding: "2px 8px", letterSpacing: "0.05em",
        }}>SAMPLE</span>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
          こんな結果が返ってきます
        </span>
      </div>
      <div style={{
        width: "100%", display: "flex", flexDirection: "column", gap: 8,
        opacity: 0.72, pointerEvents: "none", userSelect: "none",
      }}>
        {/* ロードマップ */}
        <div style={S.roadmapCard}>
          <div style={S.roadmapRow}>
            <span style={S.roadmapLabel}>🗺 ロードマップ</span>
            <span style={S.roadmapText}>{sample.roadmap}</span>
          </div>
          <div style={S.summaryText}>{sample.summary}</div>
        </div>
        {/* グループラベル */}
        <div style={S.proGroupLabel}>
          <span style={S.proGroupDot} />
          {sample.cards.length}つの視点から提案
          <span style={{ color: "#94a3b8", fontWeight: 400 }}>· 優先順位順</span>
        </div>
        {/* カード群 */}
        {sample.cards.map((c, i) => {
          const roleDef = PRO_ROLES.find(r => r.id === c.role);
          return (
            <div key={i} style={{ ...S.proCard, borderLeftColor: roleDef.color }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{
                  background: c.priority === "高" ? "#ef4444" : c.priority === "中" ? "#f59e0b" : "#94a3b8",
                  color: "white", fontSize: 10, fontWeight: 800, borderRadius: 20,
                  padding: "1px 8px", flexShrink: 0,
                }}>{c.priority}</span>
                <span style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
                  {roleDef.emoji} {roleDef.name}
                  <span style={S.proRoleEn}>{roleDef.en}</span>
                </span>
                <span style={{
                  ...S.minPill, background: roleDef.color + "15", color: roleDef.color,
                  marginLeft: "auto", flexShrink: 0,
                }}>⏱ {c.minutes}分</span>
              </div>
              <div style={S.proAction}>{c.action}</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: roleDef.color + "08",
                border: `1px solid ${roleDef.color}30`,
                borderRadius: 10, padding: "8px 10px", marginTop: 8,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: "white",
                  background: roleDef.color, borderRadius: 20,
                  padding: "1px 7px", flexShrink: 0,
                }}>助走</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", flex: 1, lineHeight: 1.4 }}>
                  {c.firstStep.action}
                </span>
                <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                  {c.firstStep.seconds}秒
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── ContextBubble(再開時の経緯パネル) ────────────────────────────────────────
function ContextBubble({ msg }) {
  const [open, setOpen] = useState(false);
  const history = msg.historySnapshot || [];
  return (
    <div style={S.contextBubble}>
      <div style={S.contextHeader}>
        <span style={S.contextIcon}>🔁</span>
        <div style={{ flex: 1 }}>
          <div style={S.contextTitle}>保留タスクを再開</div>
          {msg.savedAt && <div style={S.contextMeta}>{msg.savedAt}</div>}
        </div>
        {history.length > 0 && (
          <button style={S.contextToggle} onClick={() => setOpen(v => !v)}>
            {open ? "▲ 閉じる" : "▼ 経緯を見る"}
          </button>
        )}
      </div>
      {msg.userText && (
        <div style={S.contextPrompt}>💬 {msg.userText}</div>
      )}
      {open && history.length > 0 && (
        <div style={S.contextHistory}>
          {history.map((h, i) => (
            <div key={i} style={S.contextRow}>
              <span style={{ ...S.contextRowIcon, color: h.role === "user" ? "#2563eb" : "#64748b" }}>
                {h.role === "user" ? "💬" : "⚡"}
              </span>
              <span style={{ ...S.contextRowText, color: h.role === "user" ? "#334155" : "#64748b" }}>
                {h.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── UserBubble ───────────────────────────────────────────────────────────────
function UserBubble({ text, ts }) {
  return (
    <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "80%" }}>
      {ts && <div style={S.msgTsRight}>{ts}</div>}
      <div style={{ ...S.userBubble, alignSelf: "unset", maxWidth: "unset" }}>{text}</div>
    </div>
  );
}

// ─── MenuDrawer ───────────────────────────────────────────────────────────────
function MenuDrawer({ mode, onSetMode, visionProfile, onEditVision, pendingCount, pendingItems, onResume, onShowPending, onClose }) {
  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.drawer}>
        <div style={S.drawerSection}>モードを選ぶ</div>

        {/* プロモード */}
        <button style={{ ...S.drawerItem, ...(mode === "pro" ? S.drawerItemActive : {}) }}
          onClick={() => { onSetMode("pro"); onClose(); }}>
          <div style={{ ...S.modeIcon, background: mode === "pro" ? "#2563eb" : "#e2e8f0" }}>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ ...S.drawerName, color: mode === "pro" ? "#2563eb" : "#1e293b" }}>HAZUMI</div>
            <div style={S.drawerSub}>状況を分析して最適なロールを自動選別、複数の視点から提案</div>
          </div>
          {mode === "pro" && <span style={{ color: "#2563eb", fontWeight: 900 }}>✓</span>}
        </button>

        {/* ビジョンモード */}
        <button style={{ ...S.drawerItem, ...(mode === "vision" ? { ...S.drawerItemActive, borderColor: "#16653444", background: "#16653408" } : {}) }}
          onClick={() => { onSetMode("vision"); onClose(); }}>
          <div style={{ ...S.modeIcon, background: mode === "vision" ? "#166534" : "#e2e8f0" }}>
            <span style={{ fontSize: 18 }}>✦</span>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ ...S.drawerName, color: mode === "vision" ? "#166534" : "#1e293b" }}>ビジョンモード</div>
            <div style={S.drawerSub}>
              {visionProfile.name && visionProfile.description
                ? `「${visionProfile.name}」として判断`
                : "理想の自己像を設定して判断軸にする"}
            </div>
          </div>
          {mode === "vision" && <span style={{ color: "#166534", fontWeight: 900 }}>✓</span>}
        </button>

        {/* ビジョン設定リンク */}
        <button style={S.drawerSubLink} onClick={() => { onEditVision(); onClose(); }}>
          ✏ ビジョンプロファイルを編集
        </button>

        {pendingCount > 0 && (
          <>
            <div style={S.drawerDivider} />
            <div style={{ padding: "0 8px 6px" }}>
              {/* 「保留タスク」ラベルをクリックで一覧を開く */}
              <button style={{ ...S.drawerSection, paddingBottom: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                onClick={() => { onShowPending(); onClose(); }}>
                <span>保留タスク({pendingCount}件)</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>一覧 →</span>
              </button>
              {/* 各タスクをタップ → チャットで再開 */}
              {pendingItems.map(item => {
                const roleDef = item.proRole ? PRO_ROLES.find(r => r.id === item.proRole) : null;
                const accent = roleDef?.color || "#166534";
                return (
                  <button key={item.id} style={{ ...S.drawerItem, padding: "9px 8px", marginBottom: 2 }}
                    onClick={() => { onResume(item); onClose(); }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{roleDef ? roleDef.emoji : "✦"}</span>
                    <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.action}
                      </div>
                      <div style={{ fontSize: 11, color: accent, marginTop: 1 }}>
                        {roleDef ? roleDef.name : "ビジョン"} · {item.minutes}分
                        {item.actualSec > 0 && ` · ${fmt(item.actualSec)}経過`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>▶</span>
                  </button>
                );
              })}
            </div>
          </>
        )}


      </div>
    </>
  );
}

// ─── VisionEditor ─────────────────────────────────────────────────────────────
function VisionEditor({ profile, onSave, onCancel }) {
  const [name, setName] = useState(profile.name || "");
  const [desc, setDesc] = useState(profile.description || "");
  return (
    <>
      <div style={S.overlay} onClick={onCancel} />
      <div style={S.sheet}>
        <div style={S.sheetHandle} />
        <div style={S.sheetHeader}>
          <span style={S.sheetTitle}>ビジョンプロファイル</span>
          <button style={S.closeBtn} onClick={onCancel}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.7 }}>
          あなたが目指す「理想の自己像」を定義してください。ビジョンモードでの提案はこのプロファイルを判断軸にします。
        </p>
        <label style={S.editLabel}>ロール名・肩書き</label>
        <input style={S.editInput} value={name} placeholder="例: 副業で独立を目指すデザイナー"
          onChange={e => setName(e.target.value)} />
        <label style={S.editLabel}>美学・目標・行動原則</label>
        <textarea style={{ ...S.editInput, minHeight: 130, resize: "none", lineHeight: 1.7 }}
          value={desc} rows={5}
          placeholder={"例:\n・月20万の副業収入で会社に依存しない\n・クオリティより速度を優先しない\n・学んだことはすぐアウトプットに変える\n・体調管理を最優先、無理しない"}
          onChange={e => setDesc(e.target.value)} />
        <button style={{ ...S.primaryBtn, background: "#166534", width:"100%", marginTop: 8, opacity: name && desc ? 1 : 0.4 }}
          disabled={!name || !desc}
          onClick={() => onSave({ name, description: desc })}>
          保存して使う
        </button>
      </div>
    </>
  );
}

// ─── PendCardDetail ──────────────────────────────────────────────────────────────
function PendCardDetail({ item, accent, onResume, onEdit, onConfirmDelete }) {
  const [showHistory, setShowHistory] = useState(false);
  const history = item.historySnapshot || [];

  return (
    <>
      {/* 元プロンプト */}
      {item.userText && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, lineHeight: 1.5, background: "#f8fafc", borderRadius: 8, padding: "5px 8px" }}>
          💬 {item.userText.length > 60 ? item.userText.slice(0, 60) + "…" : item.userText}
        </div>
      )}
      {/* タスク名 */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 4, lineHeight: 1.4 }}>{item.action}</div>
      {/* メタ情報 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>⏱ {item.minutes}分</span>
        {item.savedAt && <span style={{ fontSize: 11, color: "#94a3b8" }}>· {item.savedAt}</span>}
        {item.actualSec > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>· 中断: {fmt(item.actualSec)}</span>}
      </div>
      {/* 経緯の折りたたみ */}
      {history.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button style={{ background: "transparent", border: "none", fontSize: 11, color: "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "3px 0", display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => setShowHistory(v => !v)}>
            {showHistory ? "▲" : "▼"} 経緯を{showHistory ? "閉じる" : "振り返る"}({history.length}件)
          </button>
          {showHistory && (
            <div style={{ marginTop: 6, borderLeft: "2px solid #e2e8f0", paddingLeft: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} style={{ fontSize: 11, lineHeight: 1.6 }}>
                  <span style={{ color: h.role === "user" ? "#2563eb" : "#64748b", fontWeight: 700, marginRight: 4 }}>
                    {h.role === "user" ? "💬" : "⚡"}
                  </span>
                  <span style={{ color: h.role === "user" ? "#334155" : "#64748b" }}>{h.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ボタン */}
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...S.primaryBtn, background: accent, flex: 2 }} onClick={() => onResume(item)}>▶ 再開</button>
        <button style={S.subBtn} onClick={onEdit}>修正</button>
        <button style={{ ...S.subBtn, color: "#ef4444", borderColor: "#fca5a5" }} onClick={onConfirmDelete}>削除</button>
      </div>
    </>
  );
}

// ─── PendingSheet ─────────────────────────────────────────────────────────────
function PendingSheet({ items, onResume, onEditAndRetry, onDelete, onClose }) {
  const [editId, setEditId] = useState(null);
  const [editTxt, setEditTxt] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.sheet}>
        <div style={S.sheetHandle} />
        <div style={S.sheetHeader}>
          <span style={S.sheetTitle}>保留タスク</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        {items.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0", fontSize: 14 }}>保留中のタスクはありません</div>}
        {confirmDeleteId && (() => {
          const target = items.find(i => i.id === confirmDeleteId);
          return (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>このタスクを削除しますか?</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
                {target?.action}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.primaryBtn, background: "#ef4444", flex: 2 }}
                  onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }}>
                  削除する
                </button>
                <button style={S.ghostBtn} onClick={() => setConfirmDeleteId(null)}>キャンセル</button>
              </div>
            </div>
          );
        })()}
        {items.map(item => {
          const roleDef = item.proRole ? PRO_ROLES.find(r => r.id === item.proRole) : null;
          const accent = roleDef?.color || "#166534";
          return (
            <div key={item.id} style={S.pendCard}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                {roleDef ? `${roleDef.emoji} ${roleDef.name}` : "✦ ビジョン"}
              </div>
              {editId === item.id ? (
                <>
                  <textarea style={{ ...S.editInput, marginBottom: 8, resize: "none" }} value={editTxt} rows={3} autoFocus onChange={e => setEditTxt(e.target.value)} />
                  <div style={S.btnRow}>
                    <button style={{ ...S.primaryBtn, background: accent, flex: 2 }}
                      onClick={() => { onEditAndRetry(item, editTxt.trim()); setEditId(null); }}>
                      保存して再提案
                    </button>
                    <button style={S.ghostBtn} onClick={() => setEditId(null)}>取消</button>
                  </div>
                </>
              ) : (
                <PendCardDetail item={item} accent={accent} onResume={onResume}
                  onEdit={() => { setEditId(item.id); setEditTxt(item.userText); }}
                  onConfirmDelete={() => setConfirmDeleteId(item.id)} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Hazumi() {
  const saved = loadState();
  const [mode, setMode]       = useState(saved?.mode || "pro");
  const [visionProfile, setVisionProfile] = useState(saved?.visionProfile || { name: "", description: "" });
  const [messages, setMessages]   = useState([]);
  const [pendingItems, setPendingItems] = useState(saved?.pendingItems || []);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [showMenu, setShowMenu]   = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showVisionEdit, setShowVisionEdit] = useState(false);

  const [isFocused, setIsFocused] = useState(false);
  const [resumeConfirm, setResumeConfirm] = useState(null); // 確認待ちのitem
  const [roleOpen, setRoleOpen] = useState(false);
  const chatAreaRef = useRef(null);
  const latestMsgRef = useRef(null);
  const inputRef  = useRef(null);
  const taRef     = useRef(null);
  const apiHistory = useRef([]);

  const prevMsgLen = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      // 新規メッセージ追加時は最新メッセージの先頭へスクロール
      setTimeout(() => {
        latestMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
    prevMsgLen.current = messages.length;
  }, [messages]);
  useEffect(() => { saveState({ mode, visionProfile, pendingItems }); }, [mode, visionProfile, pendingItems]);
  useEffect(() => {
    if (!loading) { setLoadingText(""); return; }
    const msgs = mode === "pro" ? PRO_LOADING_MSGS : VISION_LOADING_MSGS;
    setLoadingText(msgs[0]);
    let i = 1;
    const id = setInterval(() => { setLoadingText(msgs[i % msgs.length]); i++; }, 1500);
    return () => clearInterval(id);
  }, [loading, mode]);

  // モード切替時にチャットリセット
  const handleSetMode = (m) => {
    setMode(m);
    setMessages([]);
    apiHistory.current = [];
    setInput("");
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }

    const userMsgId = uniqueId();
    setMessages(prev => [...prev, { id: userMsgId, type: "user", text, ts: fmtTime() }]);
    setLoading(true);

    try {
      if (mode === "pro") {
        const cards = await callProMode(text, apiHistory.current);
        apiHistory.current.push({ role: "user", content: text });
        apiHistory.current.push({ role: "assistant", content: JSON.stringify(cards) });
        const proCards = cards.tasks || cards;
        setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: text, cards: proCards, roadmap: cards.roadmap || "", summary: cards.summary || "", ts: fmtTime() }]);
      } else {
        if (!visionProfile.description) {
          setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: "ビジョンプロファイルが未設定です。メニューから設定してください。" }]);
          return;
        }
        const result = await callVisionMode(text, visionProfile, apiHistory.current);
        apiHistory.current.push({ role: "user", content: text });
        apiHistory.current.push({ role: "assistant", content: JSON.stringify(result) });
        setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: text, result, resolved: null, actualSec: 0, ts: fmtTime() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: err.message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, visionProfile]);

  // ビジョン完了 → 次の提案
  const handleVisionDone = async (id, elapsed, prevResult, note = "") => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, resolved: "done", actualSec: elapsed } : m));
    const nextHint = prevResult?.next || "";
    const noteClause = note ? `
補足: ${note}` : "";
    const prompt = nextHint
      ? `前のタスクが完了しました。次は「${nextHint}」について具体的な最善手をお願いします。${noteClause}`
      : `前のタスクが完了しました。次に取り組むべき最善手を提案してください。${noteClause}`;
    apiHistory.current.push({ role: "user", content: prompt });
    setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: "✓ 完了 → 次は?", ts: fmtTime() }]);
    setLoading(true);
    try {
      const nextResult = await callVisionMode(prompt, visionProfile, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(nextResult) });
      setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: prompt, result: nextResult, resolved: null, actualSec: 0, ts: fmtTime() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleVisionPend = (id, elapsed) => {
    const historySnapshot = buildHistorySummary(messages);
    setMessages(prev => {
      const item = prev.find(m => m.id === id);
      if (!item) return prev;
      const updated = { ...item, resolved: "pend", actualSec: elapsed };
      setPendingItems(p => [...p, {
        id: item.id, userText: item.userText,
        action: item.result.action, minutes: item.result.minutes,
        reason: item.result.reason || "", tools: item.result.tools || "",
        goal: item.result.goal || "", tips: item.result.tips || "",
        next: item.result.next || "",
        actualSec: elapsed, proRole: null,
        savedAt: fmtDate(),
        historySnapshot,
      }]);
      return prev.map(m => m.id === id ? updated : m);
    });
  };

  const handleVisionRetry = async (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, resolved: "retried" } : m));
    const prompt = "その案は合わないので、別のアプローチで提案してください。";
    apiHistory.current.push({ role: "user", content: prompt });
    setLoading(true);
    try {
      const result = await callVisionMode(prompt, visionProfile, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(result) });
      const item = messages.find(m => m.id === id);
      setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: item?.userText || "", result, resolved: null, actualSec: 0 }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleProDone = async (roleId, _elapsed, _card, note = "") => {
    const roleDef = PRO_ROLES.find(r => r.id === roleId);
    const noteClause = note ? `
補足: ${note}` : "";
    const prompt = `「${roleDef?.name || roleId}」の視点でのタスクが完了しました。同じ視点で次に取り組むべき最善手を1つ提案してください。${noteClause}`;
    apiHistory.current.push({ role: "user", content: prompt });
    setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: `✓ ${roleDef?.name || ""}完了 → 次は?`, ts: fmtTime() }]);
    setLoading(true);
    try {
      const cards = await callProMode(prompt, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(cards) });
      const proCards2 = cards.tasks || cards;
      setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: prompt, cards: proCards2, roadmap: cards.roadmap || "", summary: cards.summary || "", ts: fmtTime() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleProPend = (card, userText, elapsed, pendedStepIdx = 0) => {
    const historySnapshot = buildHistorySummary(messages);
    setPendingItems(p => [...p, {
      id: uniqueId(), userText,
      action: card.action, minutes: card.minutes,
      reason: card.reason || "", tools: card.tools || "",
      goal: card.goal || "", tips: card.tips || "",
      next: card.next || "", steps: card.steps || [],
      actualSec: elapsed, pendedStepIdx, proRole: card.role,
      savedAt: fmtDate(),
      historySnapshot,
    }]);
  };

  const doResume = (item, keepMessages = false) => {
    setPendingItems(prev => prev.filter(p => p.id !== item.id));
    setShowPending(false);
    setResumeConfirm(null);

    const itemMode = item.proRole !== null && item.proRole !== undefined ? "pro" : "vision";
    setMode(itemMode);
    apiHistory.current = [];
    (item.historySnapshot || []).forEach(h => {
      apiHistory.current.push({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      });
    });

    const base = keepMessages ? messages : [];
    const resumeHistory = item.historySnapshot || [];
    if (itemMode === "pro") {
      const card = { role: item.proRole, action: item.action, minutes: item.minutes, reason: item.reason || "", tools: item.tools || "", goal: item.goal || "", tips: item.tips || "", next: item.next || "", steps: item.steps || [] };
      setMessages([
        ...base,
        { id: uniqueId(), type: "context", historySnapshot: resumeHistory, userText: item.userText, savedAt: item.savedAt },
        { id: uniqueId(), type: "pro", userText: item.userText, cards: [card] },
      ]);
    } else {
      const result = { action: item.action, minutes: item.minutes, reason: item.reason || "", tools: item.tools || "", goal: item.goal || "", tips: item.tips || "", next: item.next || "" };
      setMessages([
        ...base,
        { id: uniqueId(), type: "context", historySnapshot: resumeHistory, userText: item.userText, savedAt: item.savedAt },
        { id: uniqueId(), type: "vision", userText: item.userText, result, resolved: null, actualSec: item.actualSec || 0 },
      ]);
    }
  };

  const handleResume = (item) => {
    const itemMode = item.proRole !== null && item.proRole !== undefined ? "pro" : "vision";
    // アクティブなタスクカードが存在するか確認(unresolved)
    const activeCards = messages.filter(m =>
      (m.type === "pro" || m.type === "vision") && !m.resolved
    );
    // モードが違う かつ アクティブなカードがある場合のみ確認
    if (itemMode !== mode && activeCards.length > 0) {
      setShowPending(false);
      setShowMenu(false);
      setResumeConfirm(item);
    } else {
      doResume(item, false);
    }
  };

  const handleGoHome = () => {
    setPendingItems(prev => {
      const toAdd = [];
      messages.forEach(m => {
        // resolved: "pend" は既に保留済みなのでスキップ
        if (m.resolved === "pend" || m.resolved === "done" || m.resolved === "retried") return;
        if (m.type === "vision" && !m.resolved) {
          toAdd.push({ id: uniqueId(), userText: m.userText, action: m.result.action, minutes: m.result.minutes, actualSec: 0, proRole: null, savedAt: fmtDate() });
        }
        if (m.type === "pro" && !m.resolved) {
          // 「できた」後の単一カードのみ保留対象
          const cards = m.cards || [];
          if (cards.length === 1) {
            const c = cards[0];
            toAdd.push({ id: uniqueId(), userText: m.userText, action: c.action, minutes: c.minutes, steps: c.steps || [], actualSec: 0, proRole: c.role, savedAt: fmtDate() });
          }
        }
      });
      return [...prev, ...toAdd];
    });
    setMessages([]);
    apiHistory.current = [];
    setInput("");
  };

  // accent color per mode
  const modeAccent = mode === "pro" ? "#2563eb" : "#166534";
  const modeBg     = mode === "pro" ? "#dbeafe" : "#f0fdf4";
  const hasMessages = messages.length > 0;

  const proExamplesAll = [
    "重大なミスをしてしまった、どうすればいい?",
    "顧客からクレームが来た、次の一手は?",
    "システム障害が起きた、まず何をすべきか",
    "締め切りに間に合わない、どう対処する?",
    "上司に怒られた、立て直すには?",
    "新しい機能の開発をどこから始めるべきか",
    "会議で決まらないまま終わった、次は?",
    "タスクが多すぎて何から手をつければいい",
    "企画書を明日までに仕上げないといけない",
    "チームメンバーとうまく連携できていない",
    "副業を始めたいけど何からやればいい?",
    "転職を考えているが踏み出せない",
    "勉強を習慣化したいのに続かない",
    "メールの返信が溜まって手が付けられない",
    "今日やるべきことが多くて頭が整理できない",
  ];
  // マウント時に1度だけランダム選出して固定
  const proExamples = useMemo(() => [...proExamplesAll].sort(() => Math.random() - 0.5).slice(0, 5), []);
  const visionExamples = visionProfile.description
    ? ["今日の最優先タスクを教えて", "目標に近づくために今すべきことは?", "ここ最近サボってる、立て直すには?"]
    : [];

  return (
    <div style={{ ...S.root, background: modeBg, transition: "background 0.4s ease" }}>
      {/* Header */}
      <header style={S.header}>
        <button style={S.menuBtn} onClick={() => setShowMenu(true)}>
          <span style={{ fontSize: 20, color: "#334155" }}>≡</span>
        </button>
        <button
          style={{ display:"flex", alignItems:"center", gap:8, background:"transparent", border:"none", cursor: hasMessages ? "pointer" : "default", padding:"4px 8px", borderRadius:10 }}
          onClick={hasMessages ? handleGoHome : undefined}
          title={hasMessages ? "ホームに戻る" : ""}
        >
          <span style={{ fontSize: 16 }}>{mode === "pro" ? "⚡" : "✦"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: modeAccent }}>
            {mode === "pro" ? "HAZUMI" : "ビジョンモード"}
          </span>
          {hasMessages && <span style={{ fontSize: 11, color: modeAccent + "88" }}>↩</span>}
        </button>
        <div style={{ width: 40 }} />
      </header>

      {/* Chat */}
      <div ref={chatAreaRef} style={S.chatArea}>
        {!hasMessages && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{mode === "pro" ? "⚡" : "✦"}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: modeAccent, marginBottom: 6 }}>
              {mode === "pro" ? "HAZUMI" : "ビジョンモード"}
            </div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6, lineHeight: 1.7, textAlign: "center", maxWidth: 300 }}>
              {mode === "pro"
                ? "動き出すための、最高のきっかけ。"
                : visionProfile.description
                  ? `「${visionProfile.name}」として、あなたの美学と目標に沿った最善手を提案します`
                  : "ビジョンプロファイルを設定すると、理想の自己像を基準にした提案が受けられます"}
            </div>

            {mode === "vision" && (
              visionProfile.description ? (
                <button style={{ background: "transparent", border: `1.5px solid ${modeAccent}55`, borderRadius: 20, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: modeAccent, cursor: "pointer", margin: "10px auto 20px", display: "block" }}
                  onClick={() => setShowVisionEdit(true)}>
                  ✏ プロファイルを編集
                </button>
              ) : (
                <button style={{ ...S.primaryBtn, background: "#166534", width:"100%", maxWidth: 240, margin: "12px auto 20px" }}
                  onClick={() => setShowVisionEdit(true)}>
                  プロファイルを設定する →
                </button>
              )
            )}

{mode === "pro" && <SampleProPreview />}


            {/* プロロールの説明(折りたたみ) */}
            {mode === "pro" && (
              <div style={{ width: "100%", marginTop: 20 }}>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}
                  onClick={() => setRoleOpen(v => !v)}>
                  {roleOpen ? "▲ ロール一覧を閉じる" : "▼ 自動選別されるロールを見る"}
                </button>
                <div style={{ maxHeight: roleOpen ? "600px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease" }}>
                  <div style={{ paddingTop: 12 }}>
                    {PRO_ROLES.map(r => (
                      <div key={r.id} style={S.roleHint}>
                        <span style={{ color: r.color, fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.name}</span>
                          <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>{r.en}</span>
                          <div style={{ fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 1.5 }}>{r.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg, msgIdx) => {
          const isLatest = msgIdx === messages.length - 1;
          if (msg.type === "context") return <ContextBubble key={msg.id} msg={msg} />;
          if (msg.type === "user") return <UserBubble key={msg.id} text={msg.text} ts={msg.ts} />;
          if (msg.type === "notice") return <div key={msg.id} style={S.noticeBubble}>{msg.text}</div>;
          if (msg.type === "pro") return (
            <div key={msg.id} ref={isLatest ? latestMsgRef : null}>
              {msg.ts && <div style={S.msgTs}>{msg.ts}</div>}
              <ProResultGroup group={msg}
                onDone={(roleId, elapsed, card, note) => handleProDone(roleId, elapsed, card, note)}
                onPend={(card, elapsed, pendedStepIdx) => handleProPend(card, msg.userText, elapsed, pendedStepIdx)} />
            </div>
          );
          if (msg.type === "vision") return (
            <div key={msg.id} ref={isLatest ? latestMsgRef : null}>
              {msg.ts && <div style={S.msgTs}>{msg.ts}</div>}
              <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, paddingLeft: 4 }}>
                ✦ {visionProfile.name || "ビジョン"}
              </div>
              <SingleActionCard
                result={msg.result}
                accentColor="#166534"
                onDone={(elapsed, result, note) => handleVisionDone(msg.id, elapsed, result, note)}
                onPend={(elapsed) => handleVisionPend(msg.id, elapsed)}
                onRetry={() => handleVisionRetry(msg.id)}
              />
            </div>
          );
          return null;
        })}

        {loading && (
          <div style={S.loadingWrap}>
            {[0, 0.15, 0.3].map((d, i) => <span key={i} style={{ ...S.dot, animationDelay: `${d}s` }} />)}
            <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
              {loadingText}
            </span>
          </div>
        )}

      </div>

      {/* Input + サジェスト */}
      <div style={S.inputBar}>
        {/* サジェスト: 会話後にフォーカスしたとき */}
        {hasMessages && isFocused && !input.trim() && !loading && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {(mode === "pro" ? PRO_FOLLOW_UPS : VISION_FOLLOW_UPS).map(ex => (
              <button key={ex} style={S.suggestChip} onMouseDown={e => {
                e.preventDefault();
                setInput(ex);
                setTimeout(() => {
                  if (taRef.current) {
                    taRef.current.value = ex;
                    taRef.current.style.height = "auto";
                    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
                    taRef.current.focus();
                  }
                }, 0);
              }}>{ex}</button>
            ))}
          </div>
        )}
        {/* サジェスト: 初回（チャット履歴なし） */}
        {!hasMessages && (mode === "pro" ? proExamples : visionExamples).length > 0 && !input.trim() && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {(mode === "pro" ? proExamples : visionExamples).map(ex => (
              <button key={ex} style={S.suggestChip} onMouseDown={e => {
                e.preventDefault();
                setInput(ex);
                setTimeout(() => {
                  if (taRef.current) {
                    taRef.current.value = ex;
                    taRef.current.style.height = "auto";
                    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
                    taRef.current.focus();
                  }
                }, 0);
              }}>{ex}</button>
            ))}
          </div>
        )}
        {/* 入力フィールド */}
        <div style={{ ...S.inputCard, boxShadow: isFocused ? `0 0 0 2.5px ${modeAccent}` : "0 2px 12px rgba(0,0,0,0.10)", background: "white", transition: "box-shadow 0.2s" }}>
          <textarea
            ref={el => { inputRef.current = el; taRef.current = el; }}
            style={{ ...S.textarea, fontSize: 16, minHeight: 32 }} value={input}
            placeholder={mode === "pro" ? "課題・状況をそのまま入力…" : "今の課題をプロファイルに問う…"}
            rows={1}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button
            style={{ ...S.sendBtn, background: input.trim() && !loading ? modeAccent : "#e2e8f0", color: input.trim() && !loading ? "white" : "#94a3b8", width: 42, height: 42, borderRadius: 14, fontSize: 20, transition: "background 0.2s, color 0.2s" }}
            onClick={sendMessage} disabled={!input.trim() || loading}>↑</button>
        </div>
      </div>

      {/* Overlays */}
      {showMenu && (
        <MenuDrawer mode={mode} onSetMode={handleSetMode}
          visionProfile={visionProfile}
          onEditVision={() => setShowVisionEdit(true)}
          pendingCount={pendingItems.length}
          pendingItems={pendingItems}
          onResume={handleResume}
          onShowPending={() => setShowPending(true)}
          onClose={() => setShowMenu(false)} />
      )}
      {resumeConfirm && (() => {
        const itemMode = resumeConfirm.proRole ? "pro" : "vision";
        const itemAccent = itemMode === "pro" ? "#2563eb" : "#166534";
        const itemLabel = itemMode === "pro" ? "HAZUMI" : "ビジョンモード";
        const currentLabel = mode === "pro" ? "HAZUMI" : "ビジョンモード";
        return (
          <>
            <div style={S.overlay} onClick={() => setResumeConfirm(null)} />
            <div style={S.confirmDialog}>
              <div style={S.confirmTitle}>モードを切り替えて再開</div>
              <div style={S.confirmBody}>
                <span style={{ color: itemAccent, fontWeight: 700 }}>{itemLabel}</span>のタスクを再開します。
                現在の<span style={{ fontWeight: 700 }}>{currentLabel}</span>のチャット履歴はどうしますか?
              </div>
              <div style={{ fontSize: 13, color: "#64748b", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 16, lineHeight: 1.6 }}>
                「{resumeConfirm.action}」
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={{ ...S.primaryBtn, background: itemAccent, width: "100%" }}
                  onClick={() => {
                    // アクティブなカードを保留に自動追加してから切り替え
                    const activeCards = messages.filter(m => (m.type === "pro" || m.type === "vision") && !m.resolved);
                    activeCards.forEach(m => {
                      if (m.type === "vision") {
                        setPendingItems(p => [...p, { id: uniqueId(), userText: m.userText, action: m.result.action, minutes: m.result.minutes, actualSec: 0, proRole: null, savedAt: fmtDate() }]);
                      } else if (m.type === "pro") {
                        m.cards?.filter(c => !c.resolved).forEach(c => {
                          setPendingItems(p => [...p, { id: uniqueId(), userText: m.userText, action: c.action, minutes: c.minutes, steps: c.steps || [], actualSec: 0, proRole: c.role, savedAt: fmtDate() }]);
                        });
                      }
                    });
                    doResume(resumeConfirm, false);
                  }}>
                  現在のタスクを保留にして切り替え
                </button>
                <button style={{ ...S.primaryBtn, background: "#94a3b8", width: "100%" }}
                  onClick={() => doResume(resumeConfirm, false)}>
                  履歴を消去して切り替え
                </button>
                <button style={S.ghostBtn} onClick={() => setResumeConfirm(null)}>
                  キャンセル
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {showVisionEdit && (
        <VisionEditor profile={visionProfile}
          onSave={p => { setVisionProfile(p); setShowVisionEdit(false); }}
          onCancel={() => setShowVisionEdit(false)} />
      )}
      {showPending && (
        <PendingSheet items={pendingItems}
          onResume={handleResume}
          onEditAndRetry={async (item, newText) => {
            setPendingItems(prev => prev.filter(p => p.id !== item.id));
            setShowPending(false);
            const itemMode = item.proRole ? "pro" : "vision";
            setMode(itemMode);
            apiHistory.current = [];
            setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: `✏ 修正して再提案: ${newText}`, ts: fmtTime() }]);
            setLoading(true);
            try {
              if (itemMode === "pro") {
                const retryCards = await callProMode(newText, apiHistory.current);
                apiHistory.current.push({ role: "user", content: newText });
                apiHistory.current.push({ role: "assistant", content: JSON.stringify(retryCards) });
                const retryProCards = retryCards.tasks || retryCards;
                setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: newText, cards: retryProCards, roadmap: retryCards.roadmap || "", summary: retryCards.summary || "" }]);
              } else {
                const nextResult = await callVisionMode(newText, visionProfile, apiHistory.current);
                apiHistory.current.push({ role: "user", content: newText });
                apiHistory.current.push({ role: "assistant", content: JSON.stringify(nextResult) });
                setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: newText, result: nextResult, resolved: null, actualSec: 0 }]);
              }
            } catch (err) {
              setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: err.message }]);
            } finally {
              setLoading(false);
            }
          }}
          onDelete={id => setPendingItems(prev => prev.filter(p => p.id !== id))}
          onClose={() => setShowPending(false)} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; }
        textarea { font-family: inherit; }
        @keyframes blink {
          0%,80%,100% { opacity:0.2; transform:scale(0.75); }
          40% { opacity:1; transform:scale(1); }
        }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes slideIn  { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        @keyframes fadeIn   { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes expandIn { 0% { opacity:0.5; transform:scaleY(0.88); transform-origin:top; } 100% { opacity:1; transform:scaleY(1); } }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { display:"flex", flexDirection:"column", height:"100dvh", background:"#dbeafe", fontFamily:"'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif", maxWidth:520, margin:"0 auto", position:"relative", overflow:"hidden" },
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px 10px", flexShrink:0 },
  menuBtn: { width:40, height:40, background:"white", border:"none", borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.08)" },
  chatArea: { flex:1, overflowY:"auto", padding:"8px 16px 8px", display:"flex", flexDirection:"column", gap:10 },

  emptyState: { width:"100%", padding:"20px 0 40px", display:"flex", flexDirection:"column", alignItems:"center", animation:"fadeIn 0.4s ease" },
  exampleBtn: { width:"100%", background:"white", border:"none", borderRadius:16, padding:"13px 16px", fontSize:14, color:"#334155", cursor:"pointer", fontFamily:"inherit", textAlign:"left", lineHeight:1.5, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", marginBottom:8 },
  suggestChip: { flexShrink:0, background:"white", border:"1.5px solid #e2e8f0", borderRadius:20, padding:"8px 14px", fontSize:13, color:"#475569", cursor:"pointer", fontFamily:"inherit", fontWeight:600, whiteSpace:"nowrap", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", transition:"border-color 0.15s" },
  roleHint: { display:"flex", gap:8, padding:"6px 0", alignItems:"flex-start", borderBottom:"1px solid #e2e8f0" },

  msgTs: { fontSize: 10, color: "#94a3b8", textAlign: "left", marginBottom: 3, paddingLeft: 2 },
  msgTsRight: { fontSize: 10, color: "#94a3b8", textAlign: "right", marginBottom: 3, paddingRight: 4 },
  userBubble: { alignSelf:"flex-end", background:"white", borderRadius:"18px 18px 4px 18px", padding:"11px 16px", fontSize:15, color:"#1e293b", maxWidth:"78%", lineHeight:1.6, boxShadow:"0 1px 3px rgba(0,0,0,0.07)", animation:"fadeIn 0.2s ease" },
  noticeBubble: { alignSelf:"center", background:"#fef3c7", borderRadius:12, padding:"10px 16px", fontSize:14, color:"#92400e", maxWidth:"85%", lineHeight:1.5, textAlign:"center" },

  // Vision card
  card: { alignSelf:"flex-start", background:"white", borderRadius:"4px 18px 18px 18px", padding:"16px 16px 14px", maxWidth:"93%", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", animation:"fadeIn 0.25s ease", transition:"outline 0.1s", width:"100%" },
  cardAction: { fontSize:18, fontWeight:800, color:"#0f172a", lineHeight:1.45, marginBottom:10 },

  // Pro group
  proGroup: { width:"100%", display:"flex", flexDirection:"column", gap:8, animation:"fadeIn 0.3s ease" },
  proGroupLabel: { display:"flex", alignItems:"center", gap:7, fontSize:13, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", paddingLeft:4 },
  proGroupDot: { width:6, height:6, borderRadius:"50%", background:"#2563eb" },
  roadmapCard: { background:"white", borderRadius:14, padding:"12px 14px", border:"1px solid #dbeafe", marginBottom:4 },
  roadmapRow: { display:"flex", flexDirection:"column", gap:4, marginBottom:6 },
  roadmapLabel: { fontSize:10, fontWeight:700, color:"#2563eb", textTransform:"uppercase", letterSpacing:"0.07em" },
  roadmapText: { fontSize:14, color:"#1e293b", fontWeight:600, lineHeight:1.6 },
  summaryText: { fontSize:13, color:"#64748b", lineHeight:1.6, borderTop:"1px solid #e2e8f0", paddingTop:8, marginTop:4 },
  stepHeader: { display:"flex", alignItems:"center", gap:4, marginBottom:8 },
  stepDot: { width:8, height:8, borderRadius:"50%", flexShrink:0, transition:"background 0.3s" },
  stepAction: { fontSize:18, fontWeight:800, color:"#0f172a", lineHeight:1.4, marginBottom:10 },
  stepsPreview: { background:"#f8fafc", borderRadius:10, padding:"8px 10px", marginBottom:10, display:"flex", flexDirection:"column", gap:5 },
  stepsPreviewRow: { display:"flex", alignItems:"center", gap:6 },
  stepsPreviewNum: { width:16, height:16, borderRadius:"50%", fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  stepsPreviewTxt: { flex:1, fontSize:12, color:"#475569", lineHeight:1.4 },
  stepsPreviewTime: { fontSize:10, color:"#94a3b8", flexShrink:0 },
  proCardCompact: { background:"white", borderRadius:"4px 14px 14px 14px", padding:"11px 13px", border:"none", borderLeft:"3px solid", cursor:"pointer", width:"100%", fontFamily:"inherit", textAlign:"left", boxShadow:"0 1px 3px rgba(0,0,0,0.07)", transition:"box-shadow 0.15s" },
  proCard: { background:"white", borderRadius:"4px 14px 14px 14px", padding:"14px 14px 12px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:"3px solid", transition:"outline 0.1s" },
  proRoleTag: { display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 },
  proRoleEn: { fontSize:11, fontWeight:500, color:"#94a3b8", textTransform:"none", letterSpacing:0, marginLeft:2 },
  proAction: { fontSize:16, fontWeight:800, color:"#0f172a", lineHeight:1.45, marginBottom:8 },

  metaRow: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:8 },
  minPill: { fontSize:13, fontWeight:700, borderRadius:20, padding:"3px 12px", flexShrink:0 },
  reasonTxt: { fontSize:14, color:"#64748b", lineHeight:1.5, flex:1 },
  nextTxt: { fontSize:14, color:"#94a3b8", marginBottom:14, lineHeight:1.5, fontStyle:"italic" },

  primaryBtn: { border:"none", borderRadius:12, padding:"13px 0", fontWeight:800, fontSize:15, color:"white", cursor:"pointer", fontFamily:"inherit" },
  subRow: { display:"flex", gap:8 },
  subBtn: { flex:1, background:"white", border:"1px solid #cbd5e1", borderRadius:10, padding:"9px 0", fontSize:14, color:"#334155", cursor:"pointer", fontFamily:"inherit", fontWeight:700 },
  btnRow: { display:"flex", gap:8, alignItems:"stretch" },
  ghostBtn: { flex:1, background:"#f1f5f9", border:"none", borderRadius:12, padding:"13px 0", fontSize:14, color:"#475569", cursor:"pointer", fontFamily:"inherit", fontWeight:700 },
  pendBtnLg: { flex:1, background:"#f1f5f9", border:"2px solid #e2e8f0", borderRadius:12, padding:"13px 0", fontSize:14, color:"#475569", cursor:"pointer", fontFamily:"inherit", fontWeight:700 },
  retryBtnFull: { width:"100%", background:"transparent", border:"1px solid #e2e8f0", borderRadius:12, padding:"10px 0", fontSize:14, color:"#94a3b8", cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginTop:8 },
  supplementBtn: { width:"100%", background:"transparent", border:"1px dashed #cbd5e1", borderRadius:10, padding:"9px 0", fontSize:14, color:"#64748b", cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginTop:8 },
  detailToggle: { background:"transparent", border:"none", fontSize:13, color:"#94a3b8", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:"4px 0", marginBottom:6, display:"block" },
  detailPanel: { background:"#f8fafc", borderRadius:10, padding:"10px 12px", display:"flex", flexDirection:"column", gap:7 },
  detailRow: { display:"flex", alignItems:"flex-start", gap:6 },
  detailIcon: { fontSize:12, flexShrink:0, marginTop:1 },
  detailTxt: { fontSize:13, color:"#475569", lineHeight:1.55 },
  contextBubble: { background:"white", borderRadius:14, padding:"12px 14px", border:"1px solid #e2e8f0", marginBottom:4, animation:"fadeIn 0.3s ease" },
  contextHeader: { display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 },
  contextIcon: { fontSize:16, flexShrink:0 },
  contextTitle: { fontSize:14, fontWeight:700, color:"#1e293b" },
  contextMeta: { fontSize:13, color:"#94a3b8", marginTop:1 },
  contextToggle: { background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"3px 8px", fontSize:11, color:"#64748b", cursor:"pointer", fontFamily:"inherit", fontWeight:600, flexShrink:0 },
  contextPrompt: { fontSize:12, color:"#475569", background:"#f8fafc", borderRadius:8, padding:"5px 8px", marginBottom:6, lineHeight:1.5 },
  contextHistory: { borderLeft:"2px solid #e2e8f0", paddingLeft:10, display:"flex", flexDirection:"column", gap:6, marginTop:6 },
  contextRow: { display:"flex", gap:6, alignItems:"flex-start" },
  contextRowIcon: { fontSize:11, flexShrink:0, marginTop:1 },
  contextRowText: { fontSize:11, lineHeight:1.6 },
  confirmDialog: { position:"absolute", bottom:0, left:0, right:0, background:"white", borderRadius:"24px 24px 0 0", padding:"24px 20px 40px", zIndex:21, boxShadow:"0 -4px 24px rgba(0,0,0,0.12)", animation:"slideUp 0.25s ease" },
  confirmTitle: { fontSize:17, fontWeight:800, color:"#0f172a", marginBottom:10 },
  confirmBody: { fontSize:14, color:"#334155", lineHeight:1.7, marginBottom:12 },
  supplementArea: { width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", color:"#1e293b", fontSize:14, lineHeight:1.6, outline:"none", resize:"none", fontFamily:"inherit", marginBottom:10, display:"block" },

  progressTrack: { height:4, background:"#e2e8f0", borderRadius:2, overflow:"hidden", marginBottom:12 },
  progressFill: { height:"100%", borderRadius:2, transition:"width 0.5s linear, background 0.3s" },
  timerRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 },
  timerCell: { display:"flex", flexDirection:"column", alignItems:"flex-start" },
  timerBig: { fontSize:26, fontWeight:900, fontVariantNumeric:"tabular-nums", lineHeight:1 },
  timerSub: { fontSize:10, color:"#94a3b8", marginTop:3, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" },
  timerDisplay: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  timerHalf: { display:"flex", flexDirection:"column", alignItems:"flex-start", flex:1 },
  timerDivider: { width:1, height:36, background:"#e2e8f0", margin:"0 12px" },
  resolvedRow: { display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginTop:4 },
  resolvedSub: { fontSize:13, color:"#94a3b8" },
  goalRow: { display:"flex", alignItems:"flex-start", gap:6, background:"#f0fdf4", borderRadius:10, padding:"7px 10px", marginBottom:8 },
  goalIcon: { fontSize:13, flexShrink:0 },
  goalTxt: { fontSize:13, color:"#166534", lineHeight:1.5, fontWeight:600 },
  tipsRow: { display:"flex", alignItems:"flex-start", gap:6, background:"#fffbeb", borderRadius:10, padding:"7px 10px", marginBottom:8 },
  tipsIcon: { fontSize:13, flexShrink:0 },
  tipsTxt: { fontSize:14, color:"#92400e", lineHeight:1.55 },
  toolsRow: { display:"flex", alignItems:"flex-start", gap:6, background:"#f8fafc", borderRadius:10, padding:"7px 10px", marginBottom:10 },
  toolsIcon: { fontSize:14, flexShrink:0 },
  toolsTxt: { fontSize:13, color:"#475569", lineHeight:1.5 },

  loadingWrap: { alignSelf:"flex-start", display:"flex", alignItems:"center", gap:5, background:"white", borderRadius:"4px 18px 18px 18px", padding:"14px 18px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" },
  dot: { width:7, height:7, background:"#94a3b8", borderRadius:"50%", display:"inline-block", animation:"blink 1.2s infinite" },

  inputBar: { padding:"8px 16px 24px", flexShrink:0 },
  inputCard: { display:"flex", alignItems:"center", gap:8, background:"white", borderRadius:20, padding:"10px 10px 10px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", transition:"box-shadow 0.2s" },
  textarea: { flex:1, background:"transparent", border:"none", outline:"none", color:"#1e293b", fontSize:15, resize:"none", lineHeight:1.6, minHeight:26, maxHeight:120, overflow:"auto" },
  sendBtn: { width:38, height:38, flexShrink:0, border:"none", borderRadius:12, color:"white", fontSize:18, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"opacity 0.2s" },

  // Drawer
  overlay: { position:"absolute", inset:0, background:"rgba(15,23,42,0.25)", zIndex:20 },
  drawer: { position:"absolute", top:0, left:0, bottom:0, width:300, background:"white", zIndex:21, padding:"56px 12px 40px", animation:"slideIn 0.25s ease", boxShadow:"4px 0 24px rgba(0,0,0,0.1)", borderRadius:"0 24px 24px 0", overflowY:"auto" },
  drawerSection: { fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", padding:"0 8px 10px" },
  drawerItem: { width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 10px", border:"1px solid transparent", borderRadius:14, cursor:"pointer", fontFamily:"inherit", background:"transparent", marginBottom:4 },
  drawerItemActive: { background:"#2563eb08", borderColor:"#2563eb33" },
  modeIcon: { width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  drawerName: { fontSize:14, fontWeight:800, marginBottom:2 },
  drawerSub: { fontSize:13, color:"#94a3b8", lineHeight:1.5 },
  drawerSubLink: { width:"100%", background:"transparent", border:"none", padding:"8px 10px", fontSize:13, color:"#94a3b8", cursor:"pointer", fontFamily:"inherit", textAlign:"left" },
  drawerDivider: { height:1, background:"#f1f5f9", margin:"10px 8px" },
  roleListItem: { display:"flex", gap:10, padding:"8px 10px", alignItems:"flex-start" },

  // Sheet
  sheet: { position:"absolute", bottom:0, left:0, right:0, background:"white", borderRadius:"24px 24px 0 0", padding:"12px 20px 40px", zIndex:21, animation:"slideUp 0.25s ease", maxHeight:"82dvh", overflowY:"auto", boxShadow:"0 -4px 24px rgba(0,0,0,0.1)" },
  sheetHandle: { width:36, height:4, background:"#e2e8f0", borderRadius:2, margin:"0 auto 16px" },
  sheetHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  sheetTitle: { fontSize:17, fontWeight:800, color:"#0f172a" },
  closeBtn: { background:"transparent", border:"none", color:"#94a3b8", fontSize:18, cursor:"pointer" },

  pendCard: { background:"white", borderRadius:16, padding:14, marginBottom:10, border:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" },

  editLabel: { display:"block", fontSize:12, fontWeight:700, color:"#64748b", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" },
  editInput: { width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", color:"#1e293b", fontSize:14, outline:"none", fontFamily:"inherit", marginBottom:14, display:"block" },
};
