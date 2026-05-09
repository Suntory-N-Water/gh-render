# システム概要

## 目的

GitHub のトレンドリポジトリを毎日自動収集し、AI 要約と共にデータベースに蓄積する。

## 現行の動作フロー

```
[Cron: JST 07:00]
↓
GitHub Trending ページをスクレイピング
↓
D1 DB を参照(既存リポジトリはキャッシュ済み要約を再利用)
↓
新規リポジトリのみ README 取得 → Workers AI で日本語要約生成(短め・詳細の2段階)
↓
D1 DB に保存 or 更新(update_count をインクリメント)
↓
Web ダッシュボードで閲覧(一覧は短め要約、詳細はトグルで詳細要約を表示)
```

## 収集対象言語と件数

`wrangler.jsonc` の環境変数で管理。`'all'` は GitHub Trending の "Any language"(全言語)を表す明示的な文字列。現在の設定：

| 言語 | 件数 |
|-|--|
| typescript | 5|
| rust | 3|
| python | 3|
| all | 5|

## インフラ構成

| 役割| サービス|
|--|--|
| 実行環境| Cloudflare Workers |
| Cron トリガー | Workers Cron(`0 22 * * *` = JST 07:00) |
| データベース | Cloudflare D1(SQLite)|
| AI 要約 | Workers AI(`@cf/meta/llama-4-scout-17b-16e-instruct`)|

## データベーススキーマ

### `repositories`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | integer (PK) | サロゲートキー |
| `url` | text (UNIQUE) | リポジトリ URL |
| `description` | text | GitHub の説明文(空可) |
| `language` | text | GitHub が検出した主要言語(未検出は空文字) |
| `stars` | integer | 取得時点のスター数 |
| `first_notified_at` | timestamp | 初回トレンド入り日時 |
| `last_updated_at` | timestamp | 最終トレンド入り日時 |
| `update_count` | integer | トレンド入り回数(重要度の指標) |

### `repository_summaries`

README 取得・AI 要約が完了したリポジトリのみレコードあり(未完了は行なし)。

| カラム | 型 | 説明 |
|---|---|---|
| `repository_id` | integer (PK, FK) | `repositories.id` への参照 |
| `summary` | text | AI 生成の日本語要約(短め) |
| `created_at` | timestamp | 初回生成日時 |
| `updated_at` | timestamp | 最終更新日時 |

### `repository_detailed_summaries`

詳細要約(2段階要約の2段目)が完了したリポジトリのみレコードあり。Cron で短め要約と同時に生成。UI ではデフォルト閉じのトグルで表示。

| カラム | 型 | 説明 |
|---|---|---|
| `repository_id` | integer (PK, FK) | `repositories.id` への参照 |
| `detailed_summary` | text | AI 生成の詳細要約 |
| `created_at` | timestamp | 初回生成日時 |
| `updated_at` | timestamp | 最終更新日時 |

### `repository_readmes`(移行用・一時テーブル)

旧スキーマの `readme_content` を移行するための一時テーブル。このテーブルを元に `repository_summaries` と `repository_detailed_summaries` を生成する。移行完了後は削除予定。

| カラム | 型 | 説明 |
|---|---|---|
| `repository_id` | integer (PK, FK) | `repositories.id` への参照 |
| `readme` | text | README 本文 |
| `created_at` | timestamp | 移行日時 |
