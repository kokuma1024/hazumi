# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture

HAZUMI is a Japanese-language AI task coaching app. Users describe a challenge and receive prioritized action recommendations powered by Claude AI.

**現在のスタック（実装済み）:** React 18 + Vite + JavaScript · Vercel Edge Function · Anthropic Claude Sonnet 4  
**v1.0目標スタック:** React 18 + Vite + **TypeScript** + **Tailwind CSS** + Vercel Edge Functions + **PWA**

### v1.0リリース方針

認証・決済なしの無料版としてリリースする。ユーザー管理・課金機能は含まない。

### Key files

- [src/App.jsx](src/App.jsx) — entire frontend: ~1820 lines, all UI components, state management, and API call logic
- [api/claude.js](api/claude.js) — Vercel Edge Function, secure proxy to Anthropic API (253 lines)
- [vercel.json](vercel.json) — routes `/api/*` to serverless functions, everything else to `index.html` (SPA)

### モード構成

**HAZUMI Pro (⚡):** Calls `callProMode()`. Claude が7種のロール（Crisis / Risk / Executive / CS / Architect / Specialist / Mentor）から最適な2〜4役を自動選択し、ロールごとにタスク + ステップを返す。`ProResultGroup` / `ProCard` で表示。

**Vision Mode (✦ ビジョンモード):** Calls `callVisionMode()`. ユーザー定義の「理想の自分」ペルソナ（名前＋説明、localStorage保存）で動作し、単一推奨アクションを `SingleActionCard` で表示。

### 実行フロー（タスク）

1. **助走タスク** — 本題に入る前の準備・ウォームアップステップ（`steps[]` 配列の前半）
2. **メインタスク** — 実際に取り組む本体タスク（`steps[]` 配列の後半 or 単一タスク）

`useStepTimer()` がステップを順に自動進行させ、各ステップ完了時に Web Audio API でアラート音を鳴らす。

### State & persistence

All app state lives in React `useState` hooks inside `App`. The key `"hazumi_v1"` in `localStorage` persists: messages, pending items, mode, and vision profile across sessions. Message shape varies by type: `user`, `pro`, `vision`, `notice`, `context`.

### Timers

Two custom hooks handle timing:
- `useTimer()` — countdown for a single task with progress bar and Web Audio API alert (3-note tone)
- `useStepTimer()` — auto-progresses through multi-step tasks sequentially

### API proxy security (`api/claude.js`)

- Origin whitelist (rejects unknown origins with 403)
- Rate limit: 15 req/min · 200 req/day per IP
- Request size cap ~50 KB; system prompt ≤ 8000 chars; single message ≤ 4000 chars; history ≤ 30 messages
- Allowed models: `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`; max tokens capped at 2500

### Styling（現状 → v1.0目標）

現在: [src/App.jsx](src/App.jsx) 末尾の `S` オブジェクトによる inline CSS-in-JS。外部CSSファイル・ユーティリティフレームワークなし。  
v1.0目標: Tailwind CSS へ移行予定。
