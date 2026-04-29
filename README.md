# hazumi

即タスク実行サポートアプリ。やることが浮かんだ瞬間に、考え込まずに動き出せる状態へ持っていくためのツール。

## 目的

「やる気はあるけど、最初の一歩が重い」を最小化する。タスクを書き出した直後に *小さく着手する形* に整え、迷い時間ゼロで実行に入れることを目指す。

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フロントエンド | Vite |
| ホスティング | Vercel |
| API | Vercel Serverless Functions（`api/` ディレクトリ） |
| 言語・フレームワーク | （`src/` 内で確認 — React / Vue / 素の JS のいずれか） |

## ディレクトリ構成

```
hazumi/
├── api/             # Vercel Serverless Functions
├── src/             # フロントエンドのソース
├── index.html       # エントリーポイント
├── package.json     # 依存・スクリプト
├── vercel.json      # Vercel デプロイ設定
├── vite.config.js   # Vite ビルド設定
└── CLAUDE.md        # AI 補助用のプロジェクトノート
```

## ローカル開発

前提: Node.js 18 以上を推奨。

```bash
# 依存をインストール
npm install

# 開発サーバーを起動
npm run dev

# 本番ビルド
npm run build

# ビルド結果をプレビュー
npm run preview
```

開発サーバーは通常 `http://localhost:5173` で起動する。

## Vercel へのデプロイ

`main` ブランチへのプッシュで自動デプロイされる構成。手動で動作確認する場合は:

```bash
npm install -g vercel
vercel        # プレビューデプロイ
vercel --prod # 本番デプロイ
```

環境変数は Vercel ダッシュボードの **Settings → Environment Variables** で設定する。

## 環境変数

`api/` 内のサーバーレス関数で使う環境変数を必要に応じて `.env.local` に記載する（リポジトリにはコミットしない）:

```
# 例
OPENAI_API_KEY=...
```

## 開発メモ

- AI 開発支援用に `CLAUDE.md` をプロジェクト直下に配置している。プロジェクトの背景や設計判断はそちらに集約。
- 個人開発のため、ブランチ運用は `main` 直 push を基本とする。

## ライセンス

未定（個人開発、現時点では非公開での運用を想定）。

---

> このリポジトリは個人開発プロジェクトです。バグ報告・要望は GitHub Issues へ。
