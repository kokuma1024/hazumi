import { PRO_ROLES } from "../lib/constants";
import { fmt } from "../lib/utils";
import { S } from "../styles";
import type { Mode, VisionProfile, PendingItem } from "../types";

interface Props {
  mode: Mode;
  onSetMode: (mode: Mode) => void;
  visionProfile: VisionProfile;
  onEditVision: () => void;
  pendingCount: number;
  pendingItems: PendingItem[];
  onResume: (item: PendingItem) => void;
  onShowPending: () => void;
  onClose: () => void;
}

export function MenuDrawer({ mode, onSetMode, visionProfile, onEditVision, pendingCount, pendingItems, onResume, onShowPending, onClose }: Props) {
  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.drawer}>
        <div style={S.drawerSection}>モードを選ぶ</div>
        <button style={{ ...S.drawerItem, ...(mode === "pro" ? S.drawerItemActive : {}) }} onClick={() => { onSetMode("pro"); onClose(); }}>
          <div style={{ ...S.modeIcon, background: mode === "pro" ? "#2563eb" : "#e2e8f0" }}>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ ...S.drawerName, color: mode === "pro" ? "#2563eb" : "#1e293b" }}>HAZUMI</div>
            <div style={S.drawerSub}>状況を分析して最適なロールを自動選別、複数の視点から提案</div>
          </div>
          {mode === "pro" && <span style={{ color: "#2563eb", fontWeight: 900 }}>✓</span>}
        </button>
        <button style={{ ...S.drawerItem, ...(mode === "vision" ? { ...S.drawerItemActive, borderColor: "#16653444", background: "#16653408" } : {}) }} onClick={() => { onSetMode("vision"); onClose(); }}>
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
        <button style={S.drawerSubLink} onClick={() => { onEditVision(); onClose(); }}>✏ ビジョンプロファイルを編集</button>

        {pendingCount > 0 && (
          <>
            <div style={S.drawerDivider} />
            <div style={{ padding: "0 8px 6px" }}>
              <button style={{ ...S.drawerSection, paddingBottom: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                onClick={() => { onShowPending(); onClose(); }}>
                <span>保留タスク({pendingCount}件)</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>一覧 →</span>
              </button>
              {pendingItems.map(item => {
                const roleDef = item.proRole ? PRO_ROLES.find(r => r.id === item.proRole) : null;
                const accent = roleDef?.color || "#166534";
                return (
                  <button key={item.id} style={{ ...S.drawerItem, padding: "9px 8px", marginBottom: 2 }} onClick={() => { onResume(item); onClose(); }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{roleDef ? roleDef.emoji : "✦"}</span>
                    <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.action}</div>
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
