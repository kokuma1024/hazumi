# HAZUMI 開発ロードマップ

「動き出すための、最高のきっかけ」を形にし、磨き込んでいくための計画。
個人開発前提で、各フェーズは「動くものを最短で出す → 触って学ぶ → 次に伸ばす」のサイクルで進める。

---

## Phase 0 — 土台（ほぼ完了）

最初に "迷わず動く環境" を作る段階。

- [x] README に書いた前提（Node 18+、起動コマンド）が実際に動くことを確認
- [x] `package.json` の `name` / `description` / `scripts` を整理
- [x] `.env.example` で必要な環境変数の雛形を残す
- [x] Vercel 側の自動デプロイが `main` push で走ることを確認
- [ ] 最低限の lint / format（ESLint + Prettier）を入れる

**完了条件**: `npm run dev` 一発で開発が始められて、push すると本番が更新される状態 → 達成済み。

---

## Phase 1 — MVP（実装済み）

「思いついたら 30 秒で動き出す」最小ループは既に成立している。

### 機能（実装済み）

- [x] タスク即時入力欄（フォーカスで自動拡張する textarea）
- [x] AI によるタスク細分化（`api/claude.js` 経由で Claude Sonnet 4 を呼び、`steps[]` として「助走 → メインタスク」を返す）
- [x] 着手ボタン（▶ 始める）と、実行中は他カードを折りたたむ集中 UI
- [x] タイマー（`useTimer` / `useStepTimer`、Web Audio API でアラート、ステップ自動進行）
- [x] 完了アクション（✓ できた、補足コメント付き完了にも対応）
- [x] 保留（⏸）と再開（`ContextBubble` で経緯を保持）
- [x] チャット状態・保留・ビジョンプロファイルの `localStorage` 永続化
- [x] React `ErrorBoundary` で落ちても再読込できる
- [x] Edge Function プロキシ（Origin ホワイトリスト、IP レート制限、サイズ上限）

### 当時の MVP 仕様との差分

- 「5/15/25 分の集中タイマー固定」案 → AI が状況に応じて推定する可変分数に変更
- Pro モードは 7 ロール（Crisis / Risk / Executive / CS / Architect / Specialist / Mentor）から AI が 2〜4 役を選び、複数視点を同時提示するところまで拡張
- ビジョンモードは「理想の自己像」プロファイルに沿った 1 提案に集約

---

## Phase 2 — v1.0 公開（now）

無料版として安心して使える形に整えるフェーズ。**認証・決済は入れない方針（CLAUDE.md）**。

### 技術リファクタ

- [ ] `App.jsx`（約 1820 行）を分割：UI コンポーネント / フック / API ラッパーを別ファイルへ
- [ ] TypeScript への段階移行（分割後に `.tsx` 化、API レスポンス型を明示）
- [ ] Tailwind CSS への移行（末尾 `S` オブジェクトの inline CSS-in-JS を置き換え）
- [ ] `useTimer` と `useStepTimer` の責務整理（重複ロジックの統合）

### PWA / 配布

- [x] `manifest.json` の基本設定（name、icons、theme_color、apple-touch-icon）
- [ ] `icon-192.png` / `icon-512.png` を本番用に差し替え（現状は仮）
- [ ] Service Worker でオフライン時の最低限のフォールバック（シェルのみ）
- [ ] iOS / Android でホーム画面追加 → 起動時の見え方を確認
- [ ] PWABuilder 経由で Android（Google Play）配信の APK を準備

### 体験のブラッシュアップ

- [ ] 完了履歴ビュー（「今日／今週やったこと」を `localStorage` から振り返る）
- [ ] 入力サジェストの出し分け（現在は 15 案からランダム 5 件、状況に応じた選別へ）
- [ ] キーボードショートカットの拡充（`Cmd+Enter` で送信は実装済み、`Esc` で閉じる等）

**完了条件**: 自分自身が毎日ホーム画面から 1 タップで開いて使い続けている状態。

---

## Phase 3 — その先（未確定）

v1.0 を出した後で必要になったら考える。今は決めない。

### 検討材料

- **データのクラウド同期**: 端末をまたぎたくなったとき、`localStorage` の限界が気になり始めるか
  - 入れるなら Supabase + Google OAuth が最有力（v1.0 方針からはみ出すので慎重に）
- **ネイティブ化**: ホーム画面ウィジェット、ロック画面アクション、Siri / Shortcuts、Apple Watch が必要になったとき
  - 候補: SwiftUI（iOS 専用で品質最大化） / Capacitor（Web 版を最短でラップ） / React Native
- **有料ゲートの骨組み**: Pro モードの試行回数制限など、最小実装から

### 自分への問い

- v1.0 を出した後、自分は本当に毎日開いているか
- 完了履歴を見返す習慣ができているか（できていなければ機能として作っても無駄）
- ネイティブ化のモチベーションは「便利になるから」か「作りたいから」か（どちらでもいい、ただ意識する）

---

## 技術的な負債候補（観測ポイント）

- **`App.jsx` 1820 行**: v1.0 リファクタの最優先項目。分割しないまま TypeScript 化に入ると詰む
- **`useTimer` と `useStepTimer` の重複**: 単一ステップは「2 ステップ目だけ」と見なせば `useStepTimer` に寄せられる
- **Anthropic API コスト**: Edge Function 側のレート制限はあるが、月次の使用量モニタリングが未整備
- **`localStorage` キー `hazumi_v1` のスキーマ変更**: フィールド追加時の後方互換ロジックは現状ゆるい（`loadState` でのデフォルト値補完のみ）
- **`api/claude.js` の cold start**: Edge Function なので軽いが、関数を増やす場合は経路を分ける検討

---

最終更新: 2026-04-29
