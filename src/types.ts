export type Mode = "pro" | "vision";
export type Priority = "高" | "中" | "低";
export type ProRoleId = "crisis" | "risk" | "exec" | "cs" | "architect" | "specialist" | "mentor";
export type TimerPhase = "idle" | "running" | "supplement" | "done" | "pended";
export type ResolvedState = "done" | "pend" | "retried";

export interface VisionProfile {
  name: string;
  description: string;
}

export interface Step {
  action: string;
  seconds: number;
}

export interface ProCard {
  role: ProRoleId;
  priority?: Priority;
  action: string;
  minutes: number;
  reason?: string;
  tools?: string;
  goal?: string;
  tips?: string;
  next?: string;
  steps?: Step[];
  resolved?: boolean;
}

export interface ProResult {
  roadmap: string;
  summary: string;
  tasks: ProCard[];
}

export interface VisionResult {
  action: string;
  minutes: number;
  reason?: string;
  tools?: string;
  goal?: string;
  tips?: string;
  next?: string;
}

export interface HistoryEntry {
  role: "user" | "ai";
  text: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingItem {
  id: string;
  userText: string;
  action: string;
  minutes: number;
  reason: string;
  tools: string;
  goal: string;
  tips: string;
  next: string;
  steps?: Step[];
  actualSec: number;
  pendedStepIdx?: number;
  proRole: ProRoleId | null;
  savedAt: string;
  historySnapshot?: HistoryEntry[];
}

export interface ProRoleDef {
  id: ProRoleId;
  name: string;
  en: string;
  emoji: string;
  color: string;
  desc: string;
}

// ─── Message union types ──────────────────────────────────────────────────────

interface BaseMessage {
  id: string;
  ts?: string;
}

export interface UserMessage extends BaseMessage {
  type: "user";
  text: string;
}

export interface ProMessage extends BaseMessage {
  type: "pro";
  userText: string;
  cards: ProCard[];
  roadmap: string;
  summary: string;
  resolved?: ResolvedState;
}

export interface VisionMessage extends BaseMessage {
  type: "vision";
  userText: string;
  result: VisionResult;
  resolved: ResolvedState | null;
  actualSec: number;
}

export interface NoticeMessage extends BaseMessage {
  type: "notice";
  text: string;
}

export interface ContextMessage extends BaseMessage {
  type: "context";
  historySnapshot: HistoryEntry[];
  userText: string;
  savedAt: string;
}

export type Message = UserMessage | ProMessage | VisionMessage | NoticeMessage | ContextMessage;

export interface AppState {
  mode: Mode;
  visionProfile: VisionProfile;
  pendingItems: PendingItem[];
}
