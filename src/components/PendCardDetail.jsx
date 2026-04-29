import { useState } from "react";
import { fmt } from "../lib/utils";
import { S } from "../styles";

export function PendCardDetail({ item, accent, onResume, onEdit, onConfirmDelete }) {
  const [showHistory, setShowHistory] = useState(false);
  const history = item.historySnapshot || [];

  return (
    <>
      {item.userText && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, lineHeight: 1.5, background: "#f8fafc", borderRadius: 8, padding: "5px 8px" }}>
          💬 {item.userText.length > 60 ? item.userText.slice(0, 60) + "…" : item.userText}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 4, lineHeight: 1.4 }}>{item.action}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>⏱ {item.minutes}分</span>
        {item.savedAt && <span style={{ fontSize: 11, color: "#94a3b8" }}>· {item.savedAt}</span>}
        {item.actualSec > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>· 中断: {fmt(item.actualSec)}</span>}
      </div>
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
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...S.primaryBtn, background: accent, flex: 2 }} onClick={() => onResume(item)}>▶ 再開</button>
        <button style={S.subBtn} onClick={onEdit}>修正</button>
        <button style={{ ...S.subBtn, color: "#ef4444", borderColor: "#fca5a5" }} onClick={onConfirmDelete}>削除</button>
      </div>
    </>
  );
}
