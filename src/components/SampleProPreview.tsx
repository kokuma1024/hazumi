import { PRO_ROLES } from "../lib/constants";

interface SampleCard {
  role: string;
  priority: string;
  action: string;
  minutes: number;
  firstStep: { action: string; seconds: number };
}

export function SampleProPreview() {
  const sampleUserText = "重大なミスをしてしまった、どうすればいい?";
  const sample: { roadmap: string; summary: string; cards: SampleCard[] } = {
    roadmap: "初動対応 → 証跡確保 → 関係者連携",
    summary: "影響を最小化するため、初動と記録を最優先で進めます",
    cards: [
      { role: "crisis", priority: "高", action: "影響範囲を3行でメモに書き出す",       minutes: 3, firstStep: { action: "メモアプリを開く",     seconds: 15 } },
      { role: "risk",   priority: "中", action: "発生時刻と操作内容をスクショで残す",   minutes: 5, firstStep: { action: "スクショの準備をする", seconds: 20 } },
      { role: "cs",     priority: "中", action: "影響を受ける関係者を一覧化する",       minutes: 5, firstStep: { action: "ノートに名前欄を作る", seconds: 15 } },
    ],
  };

  return (
    <div style={{ width:"100%", marginTop:24, background:"#f8fafc", border:"1px dashed #cbd5e1", borderRadius:16, padding:"10px 12px 14px", position:"relative" }}>
      <div style={{ display:"inline-block", fontSize:10, fontWeight:800, color:"#64748b", background:"white", border:"1px solid #e2e8f0", borderRadius:20, padding:"2px 10px", letterSpacing:"0.06em", marginBottom:10 }}>
        SAMPLE · 入力するとこう返ってきます
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
        <div style={{ background:"white", borderRadius:"14px 14px 4px 14px", padding:"7px 12px", fontSize:12, color:"#475569", maxWidth:"82%", lineHeight:1.5, boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
          {sampleUserText}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6, pointerEvents:"none", userSelect:"none" }}>
        <div style={{ background:"white", borderRadius:12, padding:"8px 10px", border:"1px solid #dbeafe" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:4 }}>
            <span style={{ fontSize:9, fontWeight:700, color:"#2563eb", textTransform:"uppercase", letterSpacing:"0.07em" }}>🗺 ロードマップ</span>
            <span style={{ fontSize:12, color:"#1e293b", fontWeight:600, lineHeight:1.5 }}>{sample.roadmap}</span>
          </div>
          <div style={{ fontSize:11, color:"#64748b", lineHeight:1.5, borderTop:"1px solid #e2e8f0", paddingTop:5, marginTop:3 }}>{sample.summary}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", paddingLeft:2, marginTop:2 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"#2563eb" }} />
          {sample.cards.length}つの視点から提案
          <span style={{ color:"#cbd5e1", fontWeight:400 }}>· 優先順位順</span>
        </div>
        {sample.cards.map((c, i) => {
          const roleDef = PRO_ROLES.find(r => r.id === c.role)!;
          return (
            <div key={i} style={{ background:"white", borderRadius:"3px 12px 12px 12px", padding:"9px 11px 10px", borderLeft:`3px solid ${roleDef.color}`, boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                <span style={{ background: c.priority === "高" ? "#ef4444" : c.priority === "中" ? "#f59e0b" : "#94a3b8", color:"white", fontSize:9, fontWeight:800, borderRadius:20, padding:"0px 6px", flexShrink:0 }}>{c.priority}</span>
                <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:800, color:roleDef.color, textTransform:"uppercase", letterSpacing:"0.06em" }}>{roleDef.emoji} {roleDef.name}</span>
                <span style={{ fontSize:11, fontWeight:700, borderRadius:20, padding:"1px 9px", flexShrink:0, background:roleDef.color+"15", color:roleDef.color, marginLeft:"auto" }}>⏱ {c.minutes}分</span>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:"#0f172a", lineHeight:1.4, marginBottom:6 }}>{c.action}</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, background:roleDef.color+"08", border:`1px solid ${roleDef.color}30`, borderRadius:8, padding:"5px 8px" }}>
                <span style={{ fontSize:9, fontWeight:800, color:"white", background:roleDef.color, borderRadius:20, padding:"0px 6px", flexShrink:0 }}>助走</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#1e293b", flex:1, lineHeight:1.4 }}>{c.firstStep.action}</span>
                <span style={{ fontSize:9, color:"#94a3b8", flexShrink:0 }}>{c.firstStep.seconds}秒</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
