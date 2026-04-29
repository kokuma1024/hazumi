import { useState } from "react";
import { useTimer } from "../hooks/useTimer";
import { fmt } from "../lib/utils";
import { S } from "../styles";

export function SingleActionCard({ result, accentColor, onDone, onPend, onRetry }) {
  const estimatedSec = Math.max((result.minutes || 5) * 60, 60);
  const { phase, setPhase, elapsed, remaining, flash, start, stop } = useTimer();
  const [supplement, setSupplement] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const isOver = remaining < 0;
  const progress = Math.min(elapsed / estimatedSec, 1);
  const hasDetail = result.goal || (result.tools && result.tools !== "なし") || result.reason;

  const handleDone = (note = "") => { stop(); setPhase("done"); onDone(elapsed, result, note); };
  const handlePend = () => { stop(); setPhase("pended"); onPend(elapsed); };

  return (
    <div style={{ ...S.card, outline: flash ? `2px solid ${accentColor}` : "none" }}>
      <div style={S.cardAction}>{result.action}</div>

      {phase === "idle" && (
        <>
          <div style={S.metaRow}>
            <span style={{ ...S.minPill, background: accentColor + "18", color: accentColor }}>⏱ {result.minutes}分</span>
            {result.reason && <span style={S.reasonTxt}>{result.reason}</span>}
          </div>
          {result.goal && (
            <div style={S.goalRow}>
              <span style={S.goalIcon}>🎯</span>
              <span style={S.goalTxt}>{result.goal}</span>
            </div>
          )}
          {result.tips && (
            <div style={S.tipsRow}>
              <span style={S.tipsIcon}>💡</span>
              <span style={S.tipsTxt}>{result.tips}</span>
            </div>
          )}
          {result.tools && result.tools !== "なし" && (
            <div style={S.toolsRow}>
              <span style={S.toolsIcon}>🧰</span>
              <span style={S.toolsTxt}>{result.tools}</span>
            </div>
          )}
          {result.next && <div style={S.nextTxt}>→ {result.next}</div>}
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }} onClick={() => start(estimatedSec)}>▶ 始める</button>
            <button style={S.pendBtnLg} onClick={() => { setPhase("pended"); onPend(0); }}>⏸ 保留</button>
          </div>
          <button style={S.retryBtnFull} onClick={onRetry}>🔄 別の案を出す</button>
        </>
      )}

      {phase === "running" && (
        <>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${(1 - progress) * 100}%`, background: isOver ? "#ef4444" : accentColor }} />
          </div>
          <div style={S.timerDisplay}>
            <div style={S.timerHalf}>
              <span style={{ ...S.timerBig, fontSize: 30, color: isOver ? "#ef4444" : "#1e293b" }}>
                {isOver ? `+${fmt(-remaining)}` : fmt(remaining)}
              </span>
              <span style={S.timerSub}>{isOver ? "超過中" : "残り"}</span>
            </div>
            <div style={S.timerDivider} />
            <div style={{ ...S.timerHalf, alignItems: "flex-end" }}>
              <span style={{ ...S.timerBig, fontSize: 30, color: "#94a3b8" }}>{fmt(elapsed)}</span>
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
                  {result.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{result.goal}</span></div>}
                  {result.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{result.tips}</span></div>}
                  {result.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{result.reason}</span></div>}
                  {result.tools && result.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{result.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }} onClick={handleDone}>✓ できた</button>
            <button style={S.pendBtnLg} onClick={handlePend}>⏸ 保留</button>
          </div>
          <button style={S.supplementBtn} onClick={() => setPhase("supplement")}>
            ＋ 補足して完了
          </button>
        </>
      )}

      {phase === "supplement" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.6 }}>
            完了の補足を入力してください(例: やろうとしたけど別の問題が発生した、半分しかできなかった)
          </div>
          <textarea
            style={{ ...S.supplementArea }}
            placeholder="補足内容を入力…"
            rows={3}
            autoFocus
            value={supplement}
            onChange={e => setSupplement(e.target.value)}
          />
          <div style={S.btnRow}>
            <button style={{ ...S.primaryBtn, background: accentColor, flex:2 }}
              onClick={() => { stop(); handleDone(supplement); }}>
              この内容で完了
            </button>
            <button style={S.ghostBtn} onClick={() => setPhase("running")}>戻る</button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={S.resolvedRow}>
          <span style={{ color: accentColor, fontWeight: 700, fontSize: 13 }}>✓ 完了</span>
          <span style={S.resolvedSub}>実測 {elapsed > 0 ? fmt(elapsed) : "—"} / 予想 {result.minutes}分
            {elapsed > 0 && <span style={{ color: isOver ? "#ef4444" : "#64748b", marginLeft: 4 }}>{isOver ? `(+${fmt(-remaining)})` : `(-${fmt(remaining)})`}</span>}
          </span>
        </div>
      )}
      {phase === "pended" && (
        <div style={{ marginTop: 6 }}>
          <div style={{ ...S.resolvedRow, marginBottom: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>⏸ 保留中</span>
            {elapsed > 0 && <span style={S.resolvedSub}>中断時点 {fmt(elapsed)}</span>}
          </div>
          {hasDetail && (
            <div style={{ marginBottom: 10 }}>
              <button style={S.detailToggle} onClick={e => { e.stopPropagation(); setShowDetail(v => !v); }}>
                {showDetail ? "▲ 詳細を閉じる" : "▼ 詳細を確認する"}
              </button>
              {showDetail && (
                <div style={S.detailPanel}>
                  {result.goal && <div style={S.detailRow}><span style={S.detailIcon}>🎯</span><span style={S.detailTxt}>{result.goal}</span></div>}
                  {result.tips && <div style={S.detailRow}><span style={S.detailIcon}>💡</span><span style={S.detailTxt}>{result.tips}</span></div>}
                  {result.reason && <div style={S.detailRow}><span style={S.detailIcon}>📝</span><span style={S.detailTxt}>{result.reason}</span></div>}
                  {result.tools && result.tools !== "なし" && <div style={S.detailRow}><span style={S.detailIcon}>🧰</span><span style={S.detailTxt}>{result.tools}</span></div>}
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button style={{ ...S.primaryBtn, background: accentColor, width:"100%" }}
              onClick={() => { setPhase("running"); start(estimatedSec, elapsed); }}>
              ▶ 続きから再開({fmt(elapsed)} 経過)
            </button>
            <button style={{ ...S.primaryBtn, background: "#94a3b8", width:"100%" }}
              onClick={() => { setPhase("running"); start(estimatedSec, 0); }}>
              ■ 始めから開始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
