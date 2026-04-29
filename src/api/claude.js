const API_ENDPOINT = "/api/claude";

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

export async function callProMode(userText, conversationHistory) {
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
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return { roadmap: parsed.roadmap || "", summary: parsed.summary || "", tasks: parsed.tasks };
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return { roadmap: "", summary: "", tasks: arr };
  } catch {
    return { roadmap: "", summary: "", tasks: [{ role: "exec", action: "状況を整理してメモに書き出す", minutes: 5, reason: "まず頭の中を整理することが最優先です" }] };
  }
}

export async function callVisionMode(userText, profile, conversationHistory) {
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
