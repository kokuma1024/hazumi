import type { ProRoleDef } from "../types";

export const PRO_LOADING_MSGS: string[] = [
  "状況を分析中…",
  "クライシス視点を確認中…",
  "リスクを評価中…",
  "最適なロールを選別中…",
  "アクションを組み立て中…",
];

export const VISION_LOADING_MSGS: string[] = [
  "プロファイルを参照中…",
  "あなたの軸から判断中…",
  "最善手を探している…",
  "タスクを構成中…",
];

export const PRO_FOLLOW_UPS: string[] = ["次のステップは?", "別の視点で見ると?", "優先順位を整理して", "もっと具体的に教えて", "今日中にやるべきことは?"];
export const VISION_FOLLOW_UPS: string[] = ["次に取り組むことは?", "軌道修正するには?", "今日の最優先は?", "もっとシンプルにするには?"];

export const PRO_ROLES: ProRoleDef[] = [
  { id: "crisis",    name: "クライシス",     en: "Crisis Manager",   emoji: "🚨", color: "#dc2626", desc: "人命・法的リスク・重大損失を避けるための最短初動" },
  { id: "risk",      name: "リスク",         en: "Risk Manager",     emoji: "🛡", color: "#d97706", desc: "証跡確保・コンプライアンス・安全性重視の手順" },
  { id: "exec",      name: "エグゼクティブ", en: "Executive",        emoji: "📊", color: "#2563eb", desc: "時間・コスト・ROIを最大化する組織的判断" },
  { id: "cs",        name: "CS",             en: "Customer Success", emoji: "🤝", color: "#059669", desc: "依頼主・後工程の負担を先回りして解消する立ち回り" },
  { id: "architect", name: "アーキテクト",   en: "Architect",        emoji: "🏗", color: "#7c3aed", desc: "再利用性・仕組み化を視野に入れた根本的な工程" },
  { id: "specialist",name: "スペシャリスト", en: "Specialist",       emoji: "🔬", color: "#0891b2", desc: "専門的完成度・論理的整合性を担保する緻密な検証" },
  { id: "mentor",    name: "メンター",       en: "Mentor",           emoji: "🧘", color: "#db2777", desc: "メンタル維持・冷静さを取り戻すための内省タスク" },
];

export const STORAGE_KEY = "hazumi_v1";
