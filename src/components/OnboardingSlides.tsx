import { useState } from "react";
import { PRO_ROLES } from "../lib/constants";
import { SampleProPreview } from "./SampleProPreview";

interface Props {
  onClose: () => void;
}

export function OnboardingSlides({ onClose }: Props) {
  const [idx, setIdx] = useState(0);

  const slides = [
    {
      emoji: "⚡",
      title: "HAZUMI",
      body: (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
            動き出すための、最高のきっかけ。
          </div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.75 }}>
            課題をそのまま入力するだけで、AIが今すぐ実行できる
            アクションと時間を提案します。考えすぎず、まず1歩を
            踏み出すためのアプリです。
          </div>
        </>
      ),
    },
    {
      emoji: "💡",
      title: "こんなふうに答えます",
      body: <SampleProPreview />,
    },
    {
      emoji: "🎭",
      title: "7つのロールから自動選別",
      body: (
        <div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 12 }}>
            状況を分析し、最適な2〜4役を自動選択。多角的な視点で一手を提示します。
          </div>
          {PRO_ROLES.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: r.color, fontSize: 16, flexShrink: 0 }}>{r.emoji}</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.name}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>{r.en}</span>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      emoji: "✨",
      title: "さあ、はじめましょう",
      body: (
        <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.75 }}>
          下の入力欄に、今あなたが抱えている課題や状況をそのまま打ち込んでください。形式は問いません。AIが受け取り、最初の一手を提案します。
        </div>
      ),
    },
  ];

  const isLast = idx === slides.length - 1;
  const slide = slides[idx];

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, animation: "fadeIn 0.2s ease" }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed", left: 16, right: 16, top: "8%", bottom: "8%",
        maxWidth: 420, margin: "0 auto", background: "white",
        borderRadius: 20, padding: "20px 18px", zIndex: 101,
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        animation: "fadeIn 0.25s ease",
      }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", fontSize: 22, color: "#94a3b8", cursor: "pointer", padding: 6, lineHeight: 1 }}
          aria-label="閉じる"
        >×</button>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 4px 8px" }}>
          <div style={{ fontSize: 38, marginBottom: 6, lineHeight: 1 }}>{slide.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>
            {slide.title}
          </div>
          {slide.body}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "12px 0" }}>
          {slides.map((_, i) => (
            <span key={i} style={{
              width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
              background: i === idx ? "#2563eb" : "#cbd5e1",
              transition: "all 0.25s ease",
            }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => i - 1)}
              style={{ flex: 1, padding: "12px", background: "#f1f5f9", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "#475569", cursor: "pointer" }}
            >戻る</button>
          )}
          <button
            onClick={() => isLast ? onClose() : setIdx(i => i + 1)}
            style={{ flex: 2, padding: "12px", background: "#2563eb", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer" }}
          >{isLast ? "はじめる" : "次へ"}</button>
        </div>
      </div>
    </>
  );
}