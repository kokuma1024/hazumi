import { useState } from "react";
import { PRO_ROLES } from "../lib/constants";
import { S } from "../styles";
import { PendCardDetail } from "./PendCardDetail";

export function PendingSheet({ items, onResume, onEditAndRetry, onDelete, onClose }) {
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
