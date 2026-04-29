import { useState } from "react";
import { S } from "../styles";
import type { VisionProfile } from "../types";

interface Props {
  profile: VisionProfile;
  onSave: (profile: VisionProfile) => void;
  onCancel: () => void;
}

export function VisionEditor({ profile, onSave, onCancel }: Props) {
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
        <input style={S.editInput} value={name} placeholder="例: 副業で独立を目指すデザイナー" onChange={e => setName(e.target.value)} />
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
