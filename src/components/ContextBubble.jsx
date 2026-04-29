import { useState } from "react";
import { S } from "../styles";

export function ContextBubble({ msg }) {
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
