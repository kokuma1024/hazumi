import { STORAGE_KEY } from "./constants";

export const uniqueId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

export const buildHistorySummary = (messages) => {
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

export const fmtTime = () => {
  const d = new Date();
  return (d.getMonth()+1) + "/" + String(d.getDate()).padStart(2,"0") + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
};

export const fmtDate = () => {
  const d = new Date();
  return d.getFullYear() + " " + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0") + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + " 提案";
};

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    return {
      mode: raw.mode === "vision" ? "vision" : "pro",
      visionProfile: (raw.visionProfile && typeof raw.visionProfile === "object")
        ? { name: String(raw.visionProfile.name || ""), description: String(raw.visionProfile.description || "") }
        : { name: "", description: "" },
      pendingItems: Array.isArray(raw.pendingItems) ? raw.pendingItems : [],
    };
  } catch { return null; }
}

export const saveState = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };

export const fmt = (sec) => {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export function playAlert() {
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
