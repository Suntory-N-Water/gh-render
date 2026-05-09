# GitHub Trending Notifier

Cloudflare Workers 上で動作する、GitHub Trending の要約通知ボットです。
毎朝、新たなトレンドリポジトリを検出し、AIによる要約を付けてDiscordに通知します。

## 機能

- **トレンド監視**: 毎日 JST 7:00 に GitHub Trending をチェック
- **言語別収集**: `LANGUAGES` と `LIMITS` で対象言語と取得件数を設定
- **要約キャッシュ**: D1データベースにREADME・要約・スター数を保存し、再登場したリポジトリは既存の要約を再利用
- **AI要約**: Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`) を使用して、READMEを日本語で簡潔に要約
- **Discord通知**: 見やすいEmbed形式で情報を送信

## 仕組み

1. Cronトリガーが毎日 22:00 UTC (JST 7:00) にWorkerを起動します。
2. `LANGUAGES` に設定された言語ごとに GitHub Trending ページを取得します。空文字列の言語は全言語を表します。
3. `LIMITS` に設定された件数まで、リポジトリ名・URL・説明・言語・スター数・当日スター数を抽出します。
4. D1の `repositories` テーブルから既存データを取得します。
5. 既存の要約がある場合は再利用し、ない場合は `main` ブランチ、続いて `master` ブランチの `README.md` を取得してWorkers AIで要約します。
6. 取得した情報、README、要約、スター数、更新回数をD1に保存または更新します。
7. 言語ごとにDiscord WebhookへEmbed通知を送信します。

現在のデフォルト設定では、TypeScript 5件、Rust 3件、Python 3件、全言語 5件を通知します。

## セットアップ

### 前提条件
- Node.js / Bun
- Cloudflare アカウント (Workers AI有効化)

### インストール

```bash
# 依存関係のインストール
bun install

# ローカルDBの初期化(テーブルがない場合は初期作成から実行)
bun run db:init:local
```

### データベースマイグレーション

既存データを保持したままスキーマを更新する場合は、D1 マイグレーションを適用します。

```bash
# ローカルDBへ適用
bun run db:migrate:local

# 本番DBへ適用
bun run db:migrate:remote
```

### 環境変数
Discord Webhook URLを設定する必要があります。

**ローカル開発時 (.dev.vars):**
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

**本番デプロイ時:**
```bash
bun wrangler secret put DISCORD_WEBHOOK_URL
# URLを入力
```

### 設定

`wrangler.jsonc` の `vars` で収集対象を変更できます。

```jsonc
"vars": {
  "LANGUAGES": "typescript,rust,python,",
  "LIMITS": "5,3,3,5"
}
```

- `LANGUAGES`: カンマ区切りの言語名です。末尾の空要素は全言語を表します。
- `LIMITS`: 各言語で取得する件数です。`LANGUAGES` と同じ数だけ指定します。

`LANGUAGES` と `LIMITS` の要素数が一致しない場合、Workerはエラーを投げます。

## データ保存

D1の `repositories` テーブルに、以下の情報を保存します。

- リポジトリURL
- 言語
- GitHub Trending上の説明文
- README本文
- AI要約
- 初回通知日時・最終更新日時
- 前回取得時のスター数
- 更新回数

## 開発

```bash
# ローカルサーバー起動 (Cronモード)
bun run dev

# 手動トリガー (別ターミナルで実行)
curl "http://localhost:8787/__scheduled"
```

## デプロイ

```bash
bun run deploy
```

## 主なファイル

- `src/index.ts`: Cronトリガーのエントリポイント、言語別処理、通知の取りまとめ
- `src/crawler/scraper.ts`: GitHub Trendingページの取得とHTML解析
- `src/crawler/github.ts`: GitHub上のREADME取得
- `src/ai/summarizer.ts`: Workers AIによる日本語要約
- `src/lib/repository.ts`: D1への保存・取得
- `src/lib/notification.ts`: Discord Webhook通知
- `wrangler.jsonc`: Worker、Cron、D1、Workers AI、収集対象の設定
- `migrations/`: D1マイグレーション
