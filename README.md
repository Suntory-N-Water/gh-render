# GitHub Trending Notifier

Cloudflare Workers 上で動作する、GitHub Trending の要約通知ボットです。
毎朝、新たなトレンドリポジトリを検出し、AIによる要約を付けてDiscordに通知します。

## 機能

- **トレンド監視**: 毎日 JST 7:00 に GitHub Trending (All & TypeScript) をチェック
- **重複排除**: D1データベースを使用し、新規にランクインしたリポジトリのみを通知
- **AI要約**: Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`) を使用して、READMEを日本語で簡潔に要約
- **Discord通知**: 見やすいEmbed形式で情報を送信

## セットアップ

### 前提条件
- Node.js / Bun
- Cloudflare アカウント (Workers AI有効化)

### インストール

```bash
# 依存関係のインストール
bun install

# データベースの初期化
bun run wrangler d1 execute github-trending-db --local --file=./schema.sql
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
