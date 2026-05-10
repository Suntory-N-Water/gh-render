# Ghrender

Cloudflare Workers 上で動作する、GitHub Trending の収集・閲覧システムです。

- **Cron Worker**: 毎朝 JST 7:00 に GitHub Trending を収集し、AI 要約を D1 に保存します
- **Web ダッシュボード**: 収集したトレンドリポジトリを一覧表示・検索できる React SPA です

## 機能

- **トレンド監視**: 毎日 JST 7:00 に GitHub Trending をチェック
- **言語別収集**: `LANGUAGES` と `LIMITS` で対象言語と取得件数を設定
- **AI 要約**: Cloudflare Workers AI で README を日本語要約
- **要約キャッシュ**: 再登場したリポジトリは既存の要約を再利用
- **Web ダッシュボード**: 言語フィルタ・ソート・全文検索・無限スクロール対応

## セットアップ

### 前提条件

- Bun
- Cloudflare アカウント(Workers AI 有効化)

### インストール

```bash
bun install

# ローカル DB の初期化
bun run db:migrate:local
```

### 収集対象の設定

`wrangler.jsonc` の `vars` で収集対象を変更できます。

```jsonc
"vars": {
  "LANGUAGES": "typescript,rust,python,",
  "LIMITS": "5,3,3,5"
}
```

- `LANGUAGES`: カンマ区切りの言語名。末尾の空要素は全言語を表します
- `LIMITS`: 各言語で取得する件数。`LANGUAGES` と同じ数だけ指定します

## 開発

```bash
# フロントエンド開発サーバー (Vite、ホットリロード対応)
bun run dev
# → http://localhost:5173

# フルスタック起動 (Wrangler、Cron 手動トリガー可能)
bun run start
# → http://localhost:8787

# Cron を手動トリガー
curl "http://localhost:8787/__scheduled"

# テスト
bun run test

# 静的解析(フォーマット・Lint・型チェック)
bun run ai-check
```

## デプロイ

```bash
bun run deploy
```
