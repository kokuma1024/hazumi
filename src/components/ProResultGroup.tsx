import { useState } from "react";
import { ProRoleCard } from "./ProRoleCard";
import { S } from "../styles";
import type { ProCard, ProMessage } from "../types";

interface Props {
  group: ProMessage;
  onDone: (roleId: string, elapsed: number, card: ProCard, note: string) => void;
  onPend: (card: ProCard, elapsed: number, stepIdx: number) => void;
}

export function ProResultGroup({ group, onDone, onPend }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [doneIdx, setDoneIdx]     = useState<number | null>(null);

  return (
    <div style={S.proGroup}>
      {(group.roadmap || group.summary) && (
        <div style={S.roadmapCard}>
          {group.roadmap && (
            <div style={S.roadmapRow}>
              <span style={S.roadmapLabel}>🗺 ロードマップ</span>
              <span style={S.roadmapText}>{group.roadmap}</span>
            </div>
          )}
          {group.summary && <div style={S.summaryText}>{group.summary}</div>}
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
          onDone={(roleId, elapsed, card, note) => { setDoneIdx(i); setActiveIdx(null); onDone(roleId, elapsed, card, note); }}
          onPend={(c, elapsed, stepIdx) => { setActiveIdx(null); onPend(c, elapsed, stepIdx); }}
        />
      ))}
    </div>
  );
}
