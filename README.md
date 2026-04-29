# HAZUMI ⚡

動き出すための、最高のきっかけ。

課題をそのまま入力するだけで、AI が今すぐ実行できるアクションと時間を提案します。

## 機能

- **HAZUMI Pro** — 状況を分析し、7種のロール（クライシス/リスク/エグゼクティブ/CS/アーキテクト/スペシャリスト/メンター）から最適な 2〜4 役を自動選択。ロールごとに「助走タスク → メインタスク」のステップと内蔵タイマーを提供
- **ビジョンモード** — 「理想の自己像」プロファイルを設定し、自分の美学・目標に沿った最善手を 1 つ提案
- **保留機能** — 中断したタスクを保存し、後で続きから再開

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フロントエンド | React 18 + Vite |
| スタイリング | CSS-in-JS（inline styles） |
| API プロキシ | Vercel Edge Function (`api/claude.js`) |
| AI モデル | Anthropic Claude Sonnet / Haiku |
| ホスティング | Vercel |
| 状態永続化 | localStorage |

## ローカル開発

**前提:** Node.js 18 以上

```bash
# 1. リポジトリをクローン
git clone <repo-url>
cd hazumi

# 2. 依存をインストール
npm install

# 3. 環境変数を設定
cp .env.example .env.local
# .env.local を編集して ANTHROPIC_API_KEY を入力

# 4. 開発サーバーを起動
npm run dev
# → http://localhost:5173
```

## 環境変数

| 変数名 | 必須 | 説明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API キー（[取得先](https://console.anthropic.com/)） |
| `ALLOWED_ORIGINS` | ✅ | 本番 URL（例: `https://hazumi.vercel.app`） |
| `ALLOW_VERCEL_PREVIEW` | — | `true` にするとプレビューデプロイを許可 |

`.env.example` に雛形があります。

## Vercel へのデプロイ

`main` ブランチへの push で自動デプロイ。Vercel ダッシュボードの **Settings → Environment Variables** で環境変数を設定してください。

```bash
# 手動デプロイ
npx vercel        # プレビュー
npx vercel --prod # 本番
```

## セキュリティ設計

- API キーはサーバーサイド（Edge Function）のみで保持。クライアントには露出しない
- Origin ホワイトリストによる不正ドメインからのアクセス拒否
- IP 単位のレート制限（15 req/分・200 req/日）
- リクエストサイズ上限 50 KB、システムプロンプト 8000 文字、メッセージ 4000 文字
- レスポンスに CSP・HSTS・X-Frame-Options 等のセキュリティヘッダーを付与

## ライセンス

MIT
