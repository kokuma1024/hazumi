import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[HAZUMI] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100dvh", padding: "32px 24px", fontFamily: "'Noto Sans JP', sans-serif",
        background: "#f8fafc", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          予期しないエラーが発生しました
        </div>
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 24, maxWidth: 300 }}>
          ページを再読み込みすると解決する場合があります。
        </div>
        <button
          style={{
            background: "#2563eb", color: "white", border: "none", borderRadius: 12,
            padding: "13px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer",
            fontFamily: "inherit",
          }}
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }
}
