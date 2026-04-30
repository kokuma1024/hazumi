import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PRO_ROLES, PRO_LOADING_MSGS, VISION_LOADING_MSGS, PRO_FOLLOW_UPS, VISION_FOLLOW_UPS } from "./lib/constants";
import { uniqueId, buildHistorySummary, fmtTime, fmtDate, loadState, saveState } from "./lib/utils";
import { callProMode, callVisionMode } from "./api/claude";
import { S } from "./styles";
import { SingleActionCard } from "./components/SingleActionCard";
import { ProResultGroup } from "./components/ProResultGroup";
import { ContextBubble } from "./components/ContextBubble";
import { UserBubble } from "./components/UserBubble";
import { MenuDrawer } from "./components/MenuDrawer";
import { VisionEditor } from "./components/VisionEditor";
import { PendingSheet } from "./components/PendingSheet";
import { OnboardingSlides } from "./components/OnboardingSlides";
import type {
  Mode, Message, PendingItem, VisionMessage, ProMessage,
  ConversationMessage, VisionResult, ProCard, VisionProfile,
} from "./types";

export default function Hazumi() {
  const saved = loadState();
  const [mode, setMode]               = useState<Mode>(saved?.mode ?? "pro");
  const [visionProfile, setVisionProfile] = useState<VisionProfile>(saved?.visionProfile ?? { name: "", description: "" });
  const [messages, setMessages]       = useState<Message[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>(saved?.pendingItems ?? []);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [showMenu, setShowMenu]       = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showVisionEdit, setShowVisionEdit] = useState(false);
  const [isFocused, setIsFocused]     = useState(false);
  const [resumeConfirm, setResumeConfirm] = useState<PendingItem | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

useEffect(() => {
  if (!localStorage.getItem("hazumi.onboarded")) {
    setShowOnboarding(true);
  }
}, []);

const closeOnboarding = () => {
  setShowOnboarding(false);
  localStorage.setItem("hazumi.onboarded", "1");
};
  const chatAreaRef  = useRef<HTMLDivElement>(null);
  const latestMsgRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement | null>(null);
  const taRef        = useRef<HTMLTextAreaElement | null>(null);
  const apiHistory   = useRef<ConversationMessage[]>([]);
  const prevMsgLen   = useRef(0);

  useEffect(() => {
    if (messages.length > prevMsgLen.current) {
      setTimeout(() => {
        latestMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
    prevMsgLen.current = messages.length;
  }, [messages]);

  useEffect(() => { saveState({ mode, visionProfile, pendingItems }); }, [mode, visionProfile, pendingItems]);

  useEffect(() => {
    if (!loading) { setLoadingText(""); return; }
    const msgs = mode === "pro" ? PRO_LOADING_MSGS : VISION_LOADING_MSGS;
    setLoadingText(msgs[0]);
    let i = 1;
    const id = setInterval(() => { setLoadingText(msgs[i % msgs.length]); i++; }, 1500);
    return () => clearInterval(id);
  }, [loading, mode]);

  const handleSetMode = (m: Mode) => {
    setMode(m);
    setMessages([]);
    apiHistory.current = [];
    setInput("");
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }

    setMessages(prev => [...prev, { id: uniqueId(), type: "user", text, ts: fmtTime() }]);
    setLoading(true);

    try {
      if (mode === "pro") {
        const cards = await callProMode(text, apiHistory.current);
        apiHistory.current.push({ role: "user", content: text });
        apiHistory.current.push({ role: "assistant", content: JSON.stringify(cards) });
        setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: text, cards: cards.tasks, roadmap: cards.roadmap ?? "", summary: cards.summary ?? "", ts: fmtTime() }]);
      } else {
        if (!visionProfile.description) {
          setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: "ビジョンプロファイルが未設定です。メニューから設定してください。" }]);
          return;
        }
        const result = await callVisionMode(text, visionProfile, apiHistory.current);
        apiHistory.current.push({ role: "user", content: text });
        apiHistory.current.push({ role: "assistant", content: JSON.stringify(result) });
        setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: text, result, resolved: null, actualSec: 0, ts: fmtTime() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: (err as Error).message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, visionProfile]);

  const handleVisionDone = async (id: string, elapsed: number, prevResult: VisionResult | undefined, note = "") => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, resolved: "done" as const, actualSec: elapsed } : m));
    const nextHint = prevResult?.next ?? "";
    const noteClause = note ? `\n補足: ${note}` : "";
    const prompt = nextHint
      ? `前のタスクが完了しました。次は「${nextHint}」について具体的な最善手をお願いします。${noteClause}`
      : `前のタスクが完了しました。次に取り組むべき最善手を提案してください。${noteClause}`;
    apiHistory.current.push({ role: "user", content: prompt });
    setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: "✓ 完了 → 次は?", ts: fmtTime() }]);
    setLoading(true);
    try {
      const nextResult = await callVisionMode(prompt, visionProfile, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(nextResult) });
      setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: prompt, result: nextResult, resolved: null, actualSec: 0, ts: fmtTime() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: (err as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleVisionPend = (id: string, elapsed: number) => {
    const historySnapshot = buildHistorySummary(messages);
    setMessages(prev => {
      const item = prev.find(m => m.id === id) as VisionMessage | undefined;
      if (!item) return prev;
      const updated: VisionMessage = { ...item, resolved: "pend", actualSec: elapsed };
      setPendingItems(p => [...p, {
        id: item.id, userText: item.userText,
        action: item.result.action, minutes: item.result.minutes,
        reason: item.result.reason ?? "", tools: item.result.tools ?? "",
        goal: item.result.goal ?? "", tips: item.result.tips ?? "",
        next: item.result.next ?? "",
        actualSec: elapsed, proRole: null,
        savedAt: fmtDate(),
        historySnapshot,
      }]);
      return prev.map(m => m.id === id ? updated : m);
    });
  };

  const handleVisionRetry = async (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, resolved: "retried" as const } : m));
    const prompt = "その案は合わないので、別のアプローチで提案してください。";
    apiHistory.current.push({ role: "user", content: prompt });
    setLoading(true);
    try {
      const result = await callVisionMode(prompt, visionProfile, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(result) });
      const item = messages.find(m => m.id === id) as VisionMessage | undefined;
      setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: item?.userText ?? "", result, resolved: null, actualSec: 0 }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: (err as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleProDone = async (roleId: string, _elapsed: number, _card: ProCard, note = "") => {
    const roleDef = PRO_ROLES.find(r => r.id === roleId);
    const noteClause = note ? `\n補足: ${note}` : "";
    const prompt = `「${roleDef?.name ?? roleId}」の視点でのタスクが完了しました。同じ視点で次に取り組むべき最善手を1つ提案してください。${noteClause}`;
    apiHistory.current.push({ role: "user", content: prompt });
    setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: `✓ ${roleDef?.name ?? ""}完了 → 次は?`, ts: fmtTime() }]);
    setLoading(true);
    try {
      const cards = await callProMode(prompt, apiHistory.current);
      apiHistory.current.push({ role: "assistant", content: JSON.stringify(cards) });
      setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: prompt, cards: cards.tasks, roadmap: cards.roadmap ?? "", summary: cards.summary ?? "", ts: fmtTime() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: (err as Error).message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleProPend = (card: ProCard, userText: string, elapsed: number, pendedStepIdx = 0) => {
    const historySnapshot = buildHistorySummary(messages);
    setPendingItems(p => [...p, {
      id: uniqueId(), userText,
      action: card.action, minutes: card.minutes,
      reason: card.reason ?? "", tools: card.tools ?? "",
      goal: card.goal ?? "", tips: card.tips ?? "",
      next: card.next ?? "", steps: card.steps ?? [],
      actualSec: elapsed, pendedStepIdx, proRole: card.role,
      savedAt: fmtDate(),
      historySnapshot,
    }]);
  };

  const doResume = (item: PendingItem, keepMessages = false) => {
    setPendingItems(prev => prev.filter(p => p.id !== item.id));
    setShowPending(false);
    setResumeConfirm(null);

    const itemMode: Mode = item.proRole != null ? "pro" : "vision";
    setMode(itemMode);
    apiHistory.current = [];
    (item.historySnapshot ?? []).forEach(h => {
      apiHistory.current.push({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      });
    });

    const base = keepMessages ? messages : [];
    const resumeHistory = item.historySnapshot ?? [];
    if (itemMode === "pro") {
      const card: ProCard = {
        role: item.proRole!,
        action: item.action, minutes: item.minutes,
        reason: item.reason ?? "", tools: item.tools ?? "",
        goal: item.goal ?? "", tips: item.tips ?? "",
        next: item.next ?? "", steps: item.steps ?? [],
      };
      setMessages([
        ...base,
        { id: uniqueId(), type: "context", historySnapshot: resumeHistory, userText: item.userText, savedAt: item.savedAt },
        { id: uniqueId(), type: "pro", userText: item.userText, cards: [card], roadmap: "", summary: "" },
      ]);
    } else {
      const result: VisionResult = {
        action: item.action, minutes: item.minutes,
        reason: item.reason ?? "", tools: item.tools ?? "",
        goal: item.goal ?? "", tips: item.tips ?? "",
        next: item.next ?? "",
      };
      setMessages([
        ...base,
        { id: uniqueId(), type: "context", historySnapshot: resumeHistory, userText: item.userText, savedAt: item.savedAt },
        { id: uniqueId(), type: "vision", userText: item.userText, result, resolved: null, actualSec: item.actualSec ?? 0 },
      ]);
    }
  };

  const handleResume = (item: PendingItem) => {
    const itemMode: Mode = item.proRole != null ? "pro" : "vision";
    const hasActiveCards = messages.some(m => {
      if (m.type === "pro") return !m.resolved;
      if (m.type === "vision") return !m.resolved;
      return false;
    });
    if (itemMode !== mode && hasActiveCards) {
      setShowPending(false);
      setShowMenu(false);
      setResumeConfirm(item);
    } else {
      doResume(item, false);
    }
  };

  const handleGoHome = () => {
    setPendingItems(prev => {
      const toAdd: PendingItem[] = [];
      const historySnapshot = buildHistorySummary(messages);
      messages.forEach(m => {
        if (m.type === "vision") {
          if (m.resolved) return;
          toAdd.push({
            id: uniqueId(), userText: m.userText,
            action: m.result.action, minutes: m.result.minutes,
            reason: m.result.reason ?? "", tools: m.result.tools ?? "",
            goal: m.result.goal ?? "", tips: m.result.tips ?? "",
            next: m.result.next ?? "",
            actualSec: 0, proRole: null,
            savedAt: fmtDate(), historySnapshot,
          });
        } else if (m.type === "pro") {
          if (m.resolved) return;
          if (m.cards.length === 1) {
            const c = m.cards[0];
            toAdd.push({
              id: uniqueId(), userText: m.userText,
              action: c.action, minutes: c.minutes,
              reason: c.reason ?? "", tools: c.tools ?? "",
              goal: c.goal ?? "", tips: c.tips ?? "",
              next: c.next ?? "", steps: c.steps ?? [],
              actualSec: 0, proRole: c.role,
              savedAt: fmtDate(), historySnapshot,
            });
          }
        }
      });
      return [...prev, ...toAdd];
    });
    setMessages([]);
    apiHistory.current = [];
    setInput("");
  };

  const modeAccent = mode === "pro" ? "#2563eb" : "#166534";
  const modeBg     = mode === "pro" ? "#dbeafe" : "#f0fdf4";
  const hasMessages = messages.length > 0;

  const proExamplesAll = [
    "重大なミスをしてしまった、どうすればいい?",
    "顧客からクレームが来た、次の一手は?",
    "システム障害が起きた、まず何をすべきか",
    "締め切りに間に合わない、どう対処する?",
    "上司に怒られた、立て直すには?",
    "新しい機能の開発をどこから始めるべきか",
    "会議で決まらないまま終わった、次は?",
    "タスクが多すぎて何から手をつければいい",
    "企画書を明日までに仕上げないといけない",
    "チームメンバーとうまく連携できていない",
    "副業を始めたいけど何からやればいい?",
    "転職を考えているが踏み出せない",
    "勉強を習慣化したいのに続かない",
    "メールの返信が溜まって手が付けられない",
    "今日やるべきことが多くて頭が整理できない",
  ];
  const proExamples = useMemo(() => [...proExamplesAll].sort(() => Math.random() - 0.5).slice(0, 5), []);
  const visionExamples = visionProfile.description
    ? ["今日の最優先タスクを教えて", "目標に近づくために今すべきことは?", "ここ最近サボってる、立て直すには?"]
    : [];

  return (
    <div style={{ ...S.root, background: modeBg, transition: "background 0.4s ease" }}>
      <header style={S.header}>
        <button style={S.menuBtn} onClick={() => setShowMenu(true)}>
          <span style={{ fontSize: 20, color: "#334155" }}>≡</span>
        </button>
        <button
          style={{ display:"flex", alignItems:"center", gap:8, background:"transparent", border:"none", cursor: hasMessages ? "pointer" : "default", padding:"4px 8px", borderRadius:10 }}
          onClick={hasMessages ? handleGoHome : undefined}
          title={hasMessages ? "ホームに戻る" : ""}
        >
          <span style={{ fontSize: 16 }}>{mode === "pro" ? "⚡" : "✦"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: modeAccent }}>
            {mode === "pro" ? "HAZUMI" : "ビジョンモード"}
          </span>
          {hasMessages && <span style={{ fontSize: 11, color: modeAccent + "88" }}>↩</span>}
        </button>
        <button
          style={S.menuBtn}
          onClick={() => setShowOnboarding(true)}
          aria-label="使い方"
        >
          <span style={{ fontSize: 18, color: "#334155", fontWeight: 700 }}>?</span>
        </button>
      </header>

      <div ref={chatAreaRef} style={S.chatArea}>
        {!hasMessages && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{mode === "pro" ? "⚡" : "✦"}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: modeAccent, marginBottom: 6 }}>
              {mode === "pro" ? "HAZUMI" : "ビジョンモード"}
            </div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6, lineHeight: 1.7, textAlign: "center", maxWidth: 300 }}>
              {mode === "pro"
                ? "動き出すための、最高のきっかけ。"
                : visionProfile.description
                  ? `「${visionProfile.name}」として、あなたの美学と目標に沿った最善手を提案します`
                  : "ビジョンプロファイルを設定すると、理想の自己像を基準にした提案が受けられます"}
            </div>

            {mode === "vision" && (
              visionProfile.description ? (
                <button style={{ background: "transparent", border: `1.5px solid ${modeAccent}55`, borderRadius: 20, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: modeAccent, cursor: "pointer", margin: "10px auto 20px", display: "block" }}
                  onClick={() => setShowVisionEdit(true)}>
                  ✏ プロファイルを編集
                </button>
              ) : (
                <button style={{ ...S.primaryBtn, background: "#166534", width:"100%", maxWidth: 240, margin: "12px auto 20px" }}
                  onClick={() => setShowVisionEdit(true)}>
                  プロファイルを設定する →
                </button>
              )
            )}

          </div>
        )}

        {messages.map((msg, msgIdx) => {
          const isLatest = msgIdx === messages.length - 1;
          if (msg.type === "context") return <ContextBubble key={msg.id} msg={msg} />;
          if (msg.type === "user")    return <UserBubble key={msg.id} text={msg.text} ts={msg.ts} />;
          if (msg.type === "notice")  return <div key={msg.id} style={S.noticeBubble}>{msg.text}</div>;
          if (msg.type === "pro") return (
            <div key={msg.id} ref={isLatest ? latestMsgRef : null}>
              {msg.ts && <div style={S.msgTs}>{msg.ts}</div>}
              <ProResultGroup group={msg}
                onDone={(roleId, elapsed, card, note) => handleProDone(roleId, elapsed, card, note)}
                onPend={(card, elapsed, pendedStepIdx) => handleProPend(card, msg.userText, elapsed, pendedStepIdx)} />
            </div>
          );
          if (msg.type === "vision") return (
            <div key={msg.id} ref={isLatest ? latestMsgRef : null}>
              {msg.ts && <div style={S.msgTs}>{msg.ts}</div>}
              <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, paddingLeft: 4 }}>
                ✦ {visionProfile.name || "ビジョン"}
              </div>
              <SingleActionCard
                result={msg.result}
                accentColor="#166534"
                onDone={(elapsed, result, note) => handleVisionDone(msg.id, elapsed, result, note)}
                onPend={(elapsed) => handleVisionPend(msg.id, elapsed)}
                onRetry={() => handleVisionRetry(msg.id)}
              />
            </div>
          );
          return null;
        })}

        {loading && (
          <div style={S.loadingWrap}>
            {[0, 0.15, 0.3].map((d, i) => <span key={i} style={{ ...S.dot, animationDelay: `${d}s` }} />)}
            <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
              {loadingText}
            </span>
          </div>
        )}
      </div>

      <div style={S.inputBar}>
        {hasMessages && isFocused && !input.trim() && !loading && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {(mode === "pro" ? PRO_FOLLOW_UPS : VISION_FOLLOW_UPS).map(ex => (
              <button key={ex} style={S.suggestChip} onMouseDown={e => {
                e.preventDefault();
                setInput(ex);
                setTimeout(() => {
                  if (taRef.current) {
                    taRef.current.value = ex;
                    taRef.current.style.height = "auto";
                    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
                    taRef.current.focus();
                  }
                }, 0);
              }}>{ex}</button>
            ))}
          </div>
        )}
        {!hasMessages && (mode === "pro" ? proExamples : visionExamples).length > 0 && !input.trim() && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {(mode === "pro" ? proExamples : visionExamples).map(ex => (
              <button key={ex} style={S.suggestChip} onMouseDown={e => {
                e.preventDefault();
                setInput(ex);
                setTimeout(() => {
                  if (taRef.current) {
                    taRef.current.value = ex;
                    taRef.current.style.height = "auto";
                    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
                    taRef.current.focus();
                  }
                }, 0);
              }}>{ex}</button>
            ))}
          </div>
        )}
        <div style={{ ...S.inputCard, boxShadow: isFocused ? `0 0 0 2.5px ${modeAccent}` : "0 2px 12px rgba(0,0,0,0.10)", background: "white", transition: "box-shadow 0.2s" }}>
          <textarea
            ref={el => { inputRef.current = el; taRef.current = el; }}
            style={{ ...S.textarea, fontSize: 16, minHeight: 32 }} value={input}
            placeholder={mode === "pro" ? "課題・状況をそのまま入力…" : "今の課題をプロファイルに問う…"}
            rows={1}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            {input.length >= 3000 && (
              <span style={{ fontSize: 10, color: input.length >= 4000 ? "#ef4444" : "#f59e0b", fontWeight: 700, lineHeight: 1 }}>
                {input.length}/4000
              </span>
            )}
            <button
              style={{ ...S.sendBtn, background: input.trim() && !loading ? modeAccent : "#e2e8f0", color: input.trim() && !loading ? "white" : "#94a3b8", width: 42, height: 42, borderRadius: 14, fontSize: 20, transition: "background 0.2s, color 0.2s" }}
              onClick={sendMessage} disabled={!input.trim() || loading || input.length > 4000}>↑</button>
          </div>
        </div>
      </div>

      {showMenu && (
        <MenuDrawer mode={mode} onSetMode={handleSetMode}
          visionProfile={visionProfile}
          onEditVision={() => setShowVisionEdit(true)}
          pendingCount={pendingItems.length}
          pendingItems={pendingItems}
          onResume={handleResume}
          onShowPending={() => setShowPending(true)}
          onClose={() => setShowMenu(false)} />
      )}

      {resumeConfirm && (() => {
        const itemMode = resumeConfirm.proRole ? "pro" : "vision";
        const itemAccent = itemMode === "pro" ? "#2563eb" : "#166534";
        const itemLabel = itemMode === "pro" ? "HAZUMI" : "ビジョンモード";
        const currentLabel = mode === "pro" ? "HAZUMI" : "ビジョンモード";
        return (
          <>
            <div style={S.overlay} onClick={() => setResumeConfirm(null)} />
            <div style={S.confirmDialog}>
              <div style={S.confirmTitle}>モードを切り替えて再開</div>
              <div style={S.confirmBody}>
                <span style={{ color: itemAccent, fontWeight: 700 }}>{itemLabel}</span>のタスクを再開します。
                現在の<span style={{ fontWeight: 700 }}>{currentLabel}</span>のチャット履歴はどうしますか?
              </div>
              <div style={{ fontSize: 13, color: "#64748b", background: "#f8fafc", borderRadius: 10, padding: "10px 12px", marginBottom: 16, lineHeight: 1.6 }}>
                「{resumeConfirm.action}」
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={{ ...S.primaryBtn, background: itemAccent, width: "100%" }}
                  onClick={() => {
                    messages.forEach(m => {
                      if (m.type === "vision" && !m.resolved) {
                        setPendingItems(p => [...p, {
                          id: uniqueId(), userText: m.userText,
                          action: m.result.action, minutes: m.result.minutes,
                          reason: m.result.reason ?? "", tools: m.result.tools ?? "",
                          goal: m.result.goal ?? "", tips: m.result.tips ?? "",
                          next: m.result.next ?? "",
                          actualSec: 0, proRole: null, savedAt: fmtDate(),
                        }]);
                      } else if (m.type === "pro" && !m.resolved) {
                        m.cards.filter(c => !c.resolved).forEach(c => {
                          setPendingItems(p => [...p, {
                            id: uniqueId(), userText: m.userText,
                            action: c.action, minutes: c.minutes,
                            reason: c.reason ?? "", tools: c.tools ?? "",
                            goal: c.goal ?? "", tips: c.tips ?? "",
                            next: c.next ?? "", steps: c.steps ?? [],
                            actualSec: 0, proRole: c.role, savedAt: fmtDate(),
                          }]);
                        });
                      }
                    });
                    doResume(resumeConfirm, false);
                  }}>
                  現在のタスクを保留にして切り替え
                </button>
                <button style={{ ...S.primaryBtn, background: "#94a3b8", width: "100%" }}
                  onClick={() => doResume(resumeConfirm, false)}>
                  履歴を消去して切り替え
                </button>
                <button style={S.ghostBtn} onClick={() => setResumeConfirm(null)}>
                  キャンセル
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {showVisionEdit && (
        <VisionEditor profile={visionProfile}
          onSave={p => { setVisionProfile(p); setShowVisionEdit(false); }}
          onCancel={() => setShowVisionEdit(false)} />
      )}

      {showPending && (
        <PendingSheet items={pendingItems}
          onResume={handleResume}
          onEditAndRetry={async (item, newText) => {
            setPendingItems(prev => prev.filter(p => p.id !== item.id));
            setShowPending(false);
            const itemMode: Mode = item.proRole ? "pro" : "vision";
            setMode(itemMode);
            apiHistory.current = [];
            setMessages(prev => [...prev, { id: uniqueId(), type: "user", text: `✏ 修正して再提案: ${newText}`, ts: fmtTime() }]);
            setLoading(true);
            try {
              if (itemMode === "pro") {
                const retryCards = await callProMode(newText, apiHistory.current);
                apiHistory.current.push({ role: "user", content: newText });
                apiHistory.current.push({ role: "assistant", content: JSON.stringify(retryCards) });
                setMessages(prev => [...prev, { id: uniqueId(), type: "pro", userText: newText, cards: retryCards.tasks, roadmap: retryCards.roadmap ?? "", summary: retryCards.summary ?? "" }]);
              } else {
                const nextResult = await callVisionMode(newText, visionProfile, apiHistory.current);
                apiHistory.current.push({ role: "user", content: newText });
                apiHistory.current.push({ role: "assistant", content: JSON.stringify(nextResult) });
                setMessages(prev => [...prev, { id: uniqueId(), type: "vision", userText: newText, result: nextResult, resolved: null, actualSec: 0 }]);
              }
            } catch (err) {
              setMessages(prev => [...prev, { id: uniqueId(), type: "notice", text: (err as Error).message }]);
            } finally {
              setLoading(false);
            }
          }}
          onDelete={id => setPendingItems(prev => prev.filter(p => p.id !== id))}
          onClose={() => setShowPending(false)} />
      )}

      {showOnboarding && <OnboardingSlides onClose={closeOnboarding} />}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; }
        textarea { font-family: inherit; }
        @keyframes blink {
          0%,80%,100% { opacity:0.2; transform:scale(0.75); }
          40% { opacity:1; transform:scale(1); }
        }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes slideIn  { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        @keyframes fadeIn   { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        @keyframes expandIn { 0% { opacity:0.5; transform:scaleY(0.88); transform-origin:top; } 100% { opacity:1; transform:scaleY(1); } }
      `}</style>
    </div>
  );
}
