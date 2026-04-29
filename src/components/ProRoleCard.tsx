import { useState } from "react";
import { PRO_ROLES } from "../lib/constants";
import { useTimer } from "../hooks/useTimer";
import { useStepTimer } from "../hooks/useStepTimer";
import { fmt } from "../lib/utils";
import { S } from "../styles";
import type { ProCard, Step } from "../types";

interface Props {
  item: ProCard;
  collapsed: boolean;
  compact: boolean;
  onDone: (roleId: string, elapsed: number, card: ProCard, note: string) => void;
  onPend: (card: ProCard, elapsed: number, stepIdx: number) => void;
  onStart: () => void;
}

export function ProRoleCard({ item, collapsed, compact, onDone, onPend, onStart }: Props) {
  const roleDef = PRO_ROLES.find(r => r.id === item.role) || PRO_ROLES[2];
  const estimatedSec = Math.max((item.minutes || 5) * 60, 60);
  const { phase, setPhase } = useTimer();
  const [supplement, setSupplement] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [pendedStepIdx, setPendedStepIdx] = useState(0);
  const [pendedElapsed, setPendedElapsed] = useState(0);
  const hasDetail = item.goal || (item.tools && item.tools !== "なし") || item.reason;

  const steps: Step[] = item.steps?.length ? item.steps : [{ action: item.action, seconds: estimatedSec }];
  const stepTimer = useStepTimer(steps, (totalElapsed) => {
    setPhase("done");
    onDone(item.role, totalElapsed, item, "");
  });

  const flash = stepTimer.flash;
  const handleStart = () => { onStart(); setPhase("running"); stepTimer.start(); };
  const handleDone  = (note = "") => { stepTimer.stop(); setPhase("done"); onDone(item.role, stepTimer.elapsed, item, note); };
  const handlePend  = () => {
    const si = stepTimer.stepIdx >= 0 ? stepTimer.stepIdx : 0;
    const el = stepTimer.elapsed;
    stepTimer.stop();
    setPendedStepIdx(si);
    setPendedElapsed(el);
    setPhase("pended");
    onPend(item, el, si);
  };

  if (compact && phase === "idle") {
    return (
      <div style={{ ...S.proCard, borderLeftColor: roleDef.color, overflow: "hidden" }}>
        <div style={{ cursor: "pointer" }} onClick={() => setCompactExpanded(v => !v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {item.priority && (
              <span style={{
                background: item.priority === "高" ? "#ef4444" : item.priority === "中" ? "#f59e0b" : "#94a3b8",
                color: "white", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 8px", flexShrink: 0,
              }}>{item.priority}</span>
            )}
            <span style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
              {roleDef.emoji} {roleDef.name}
              <span style={S.proRoleEn}>{roleDef.en}</span>
            </span>
            <span style={{ ...S.minPill, background: roleDef.color + "15", color: roleDef.color, marginLeft: "auto", flexShrink: 0 }}>⏱ {item.minutes}分</span>
          </div>
          <div style={S.proAction}>{item.action}</div>
          {item.steps?.length && steps[0] && !compactExpanded && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
              <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4, flex: 1 }}>{steps[0].action}</span>
              <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
              </span>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginTop: 4 }}>
            {compactExpanded ? "▲ 閉じる" : "▼ 詳細を見る"}
          </div>
        </div>
        <div style={{ maxHeight: compactExpanded ? "600px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease" }}>
          <div style={{ paddingTop: 12 }}>
            {item.goal && <div style={S.goalRow}><span style={S.goalIcon}>🎯</span><span style={S.goalTxt}>{item.goal}</span></div>}
            {item.tips && <div style={S.tipsRow}><span style={S.tipsIcon}>💡</span><span style={S.tipsTxt}>{item.tips}</span></div>}
            {item.tools && item.tools !== "なし" && <div style={S.toolsRow}><span style={S.toolsIcon}>🧰</span><span style={S.toolsTxt}>{item.tools}</span></div>}
            {item.steps?.length && steps[0] && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: roleDef.color + "08", border: `1px solid ${roleDef.color}30`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1, lineHeight: 1.4 }}>{steps[0].action}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                  {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
                </span>
              </div>
            )}
            <div style={S.btnRow}>
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex: 2 }} onClick={e => { e.stopPropagation(); handleStart(); }}>▶ 始める</button>
              <button style={S.pendBtnLg} onClick={e => { e.stopPropagation(); handlePend(); }}>⏸ 保留</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (collapsed && phase === "idle") {
    return (
      <div style={{ ...S.proCard, borderLeftColor: roleDef.color, opacity: 0.45 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
            {roleDef.emoji} {roleDef.name}
            <span style={S.proRoleEn}>{roleDef.en}</span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{item.minutes}分</span>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 1.4 }}>{item.action}</div>
      </div>
    );
  }

  return (
    <div style={{ ...S.proCard, borderLeftColor: roleDef.color, outline: flash ? `2px solid ${roleDef.color}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ ...S.proRoleTag, color: roleDef.color, marginBottom: 0 }}>
          {item.priority && (
            <span style={{
              background: item.priority === "高" ? "#ef4444" : item.priority === "中" ? "#f59e0b" : "#94a3b8",
              color: "white", fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 8px", marginRight: 4,
            }}>{item.priority}</span>
          )}
          {roleDef.emoji} {roleDef.name}
          <span style={S.proRoleEn}>{roleDef.en}</span>
        </div>
        <span style={{ ...S.minPill, background: roleDef.color + "15", color: roleDef.color, flexShrink: 0 }}>⏱ {item.minutes}分</span>
      </div>
      <div style={{ ...S.proAction, ...(phase === "running" ? { fontSize: 12, color: "#94a3b8", fontWeight: 500, marginBottom: 6 } : {}) }}>{item.action}</div>

      {phase === "idle" && (
        <>
          <div style={S.metaRow}>{item.reason && <span style={S.reasonTxt}>{item.reason}</span>}</div>
          {item.goal && <div style={S.goalRow}><span style={S.goalIcon}>🎯</span><span style={S.goalTxt}>{item.goal}</span></div>}
          {item.tips && <div style={S.tipsRow}><span style={S.tipsIcon}>💡</span><span style={S.tipsTxt}>{item.tips}</span></div>}
          {item.tools && item.tools !== "なし" && <div style={S.toolsRow}><span style={S.toolsIcon}>🧰</span><span style={S.toolsTxt}>{item.tools}</span></div>}
          {item.steps?.length && steps[0] && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: roleDef.color + "08", border: `1px solid ${roleDef.color}30`, borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "white", background: roleDef.color, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>助走</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1, lineHeight: 1.4 }}>{steps[0].action}</span>
              <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>
                {steps[0].seconds < 60 ? `${steps[0].seconds}秒` : `${Math.round(steps[0].seconds/60)}分`}
              </span>
            </div>
          )}
          <div style={S.btnRow} onClick={e => e.stopPropagation()}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={handleStart}>▶ 始める</button>
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          <div style={S.stepHeader}>
            {steps.map((_, i) => (
              <div key={i} style={{ ...S.stepDot, background: i <= stepTimer.stepIdx ? roleDef.color : "#e2e8f0", opacity: i < stepTimer.stepIdx ? 0.4 : 1 }} />
            ))}
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>
              {stepTimer.stepIdx === 0 ? "助走" : "メインタスク"}
            </span>
          </div>
          <div style={S.stepAction}>{stepTimer.currentStep?.action}</div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(1 - stepTimer.progress) * 100}%`, background: stepTimer.isOver ? "#ef4444" : roleDef.color }} />
          </div>
          <div style={S.timerDisplay}>
            <div style={S.timerHalf}>
              <span style={{ ...S.timerBig, fontSize: 26, color: stepTimer.isOver ? "#ef4444" : "#1e293b" }}>
                {stepTimer.isOver ? `+${fmt(-stepTimer.remaining)}` : fmt(stepTimer.remaining)}
              </span>
              <span style={S.timerSub}>{stepTimer.isOver ? "超過中" : "残り"}</span>
            </div>
            <div style={S.timerDivider} />
            <div style={{ ...S.timerHalf, alignItems: "flex-end" }}>
              <span style={{ ...S.timerBig, fontSize: 26, color: "#94a3b8" }}>{fmt(stepTimer.elapsed)}</span>
              <span style={S.timerSub}>経過</span>
            </div>
          </div>
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {item.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{item.goal}</span></div>}
                  {item.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{item.tips}</span></div>}
                  {item.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{item.reason}</span></div>}
                  {item.tools && item.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{item.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={S.btnRow} onClick={e => e.stopPropagation()}>
            {stepTimer.stepIdx < stepTimer.totalSteps - 1 ? (
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={stepTimer.nextStep}>✓ 準備OK → メインタスクへ</button>
            ) : (
              <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={() => handleDone()}>✓ タスク完了</button>
            )}
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
          <button style={S.supplementBtn} onClick={e => { e.stopPropagation(); setPhase("supplement"); }}>＋ 補足して完了</button>
        </>
      )}

      {phase === "supplement" && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.6 }}>完了の補足を入力してください</div>
          <textarea style={{ ...S.supplementArea }} placeholder="補足内容を入力…" rows={3} autoFocus value={supplement} onChange={e => setSupplement(e.target.value)} />
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, flex:2 }} onClick={() => { stepTimer.stop(); handleDone(supplement); }}>この内容で完了</button>
            <button style={S.ghostBtn} onClick={() => setPhase("running")}>戻る</button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={S.resolvedRow}>
          <span style={{ color: roleDef.color, fontWeight: 700, fontSize: 13 }}>✓ 完了</span>
          <span style={S.resolvedSub}>実測 {fmt(stepTimer.elapsed)} / 予想 {item.minutes}分</span>
        </div>
      )}
      {phase === "pended" && (
        <div style={{ marginTop: 6 }}>
          <div style={{ ...S.resolvedRow, marginBottom: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>⏸ 保留中</span>
            {pendedElapsed > 0 && <span style={S.resolvedSub}>中断時点 {fmt(pendedElapsed)}({pendedStepIdx === 0 ? "助走" : "メインタスク"})</span>}
          </div>
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {item.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{item.goal}</span></div>}
                  {item.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{item.tips}</span></div>}
                  {item.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{item.reason}</span></div>}
                  {item.tools && item.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{item.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button style={{ ...S.primaryBtn, background: roleDef.color, width:"100%" }} onClick={() => { setPhase("running"); stepTimer.resumeAt(pendedStepIdx, pendedElapsed); }}>
              ▶ 続きから再開({fmt(pendedElapsed)} 経過)
            </button>
            <button style={{ ...S.primaryBtn, background: "#94a3b8", width:"100%" }} onClick={() => { setPhase("running"); stepTimer.start(); }}>
              ■ 始めから開始(助走から)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
