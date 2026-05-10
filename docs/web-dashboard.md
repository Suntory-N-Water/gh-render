# Web ダッシュボード 計画

## 背景・動機

- Discord 通知だけだと毎日うるさい
- 「あのリポジトリなんだっけ？」と過去トレンドを振り返れない
- GitHub トレンド ≒ 業界トレンドなので、蓄積データに価値がある
- Discord 通知は廃止し、Web で閲覧できるようにする

## 対象ユーザー

誰でも閲覧可能(認証なし)

---

## 機能要件

### 一覧表示
- リポジトリをカード形式で表示する
- 1 画面のみ(詳細ページへの遷移なし)
- カードに要約を 2 段階でトグル表示する
  - 短い要約：カードに常時表示
  - 詳細な要約：トグルで展開

### ソート
- デフォルト：最近トレンド入りした日付が新しい順(`last_updated_at` 降順)
- 切り替え可能なソート項目：
  - スター数順(`stars` 降順)
  - トレンド入り回数順(`update_count` 降順)

### フィルタ
- 言語で絞り込み：バックエンドの `trend_configs` テーブルから動的生成(ハードコードしない)

### 全文検索
- 検索対象：リポジトリ名・URL・説明文・短め要約・詳細要約(README 本文は対象外)
- バックエンドが SQL(FTS5)を発行して返す
- デバウンス処理で無駄なリクエストを防ぐ
- 結果が 0 件の場合は Empty State を表示する

### ページネーション
- 無限スクロールを採用
- フィルタ・検索・ソートを変更した場合は一覧をリセットし、条件に合った最初のデータから再度無限スクロールを開始する

### UX 要件
- 操作後は即座にスケルトン表示し、データ差し替え時にちらつきを起こさない
- レイアウトシフトが起きないカード設計(スター数などは tabular numbers を使用)
- スマホメインで快適に操作できるフィルタ・ソート UI
- フィルタ・ソート・検索の状態は URL クエリパラメータと同期する(後回し可)

---

## 技術方針

### スタック

| 役割 | 採用 |
|--|--|
| フロントエンド | React + Vite |
| UI コンポーネント | shadcn/ui |
| バックエンド API | Hono(既存 Worker に API ルート追加) |
| データベース | D1 継続。FTS5 テーブルを追加 |
| デプロイ先 | Cloudflare Workers |
| ビルド | `@cloudflare/vite-plugin`(クライアント・サーバー一体ビルド) |

### ディレクトリ構成

単一パッケージ。`@cloudflare/vite-plugin` によりクライアントとサーバーを一体でビルドし、Worker が静的アセットも配信する。

```
src/
  client/   # React + Vite フロントエンド
  server/   # Hono + Worker バックエンド
```

### FTS5 全文検索の方針

- `repositories_fts` という FTS5 仮想テーブルを新規マイグレーションで作成する
- インデックス対象カラム：`url`・`description`(`repositories`)、`summary`(`repository_summaries`)、`detailed_summary`(`repository_detailed_summaries`)
- FTS5 の content テーブル機能は 3 テーブルの JOIN には対応できないため、コンテンツレスで作成し、Worker(Cron)の書き込み処理と同時に手動で同期する
- 検索ボックス入力のたびにバックエンド API へリクエスト → D1 で FTS5 クエリを発行

---

## 廃止・削除するもの

- Discord Webhook 通知(`src/notification.ts`)
- `NotificationAdapter` 型、`NotificationContent` 型
- `repository_readmes` テーブル(移行完了後に削除。README 本文は今後保存しない)

---

## システム構成とデータ経路

### Worker の役割

```
Cloudflare Workers(単一 Worker)
├── Cron ハンドラ       … バックグラウンド書き込み
├── Hono API ルート     … フロントエンドへの JSON 配信(新規追加)
└── 静的アセット配信    … dist/client を返す(@cloudflare/vite-plugin)
```

API と静的ファイルが同一オリジンのため CORS 不要。

### Cron フロー(書き込み)

```
[毎日 JST 07:00]
  ↓
GitHub Trending スクレイピング
  ↓
D1: 既存リポジトリ確認
  ↓ 新規のみ
GitHub README 取得 → Workers AI で要約 2 種生成(短め・詳細)
  ↓
D1: repositories / repository_summaries / repository_detailed_summaries に保存
D1: repositories_fts(FTS5)に rowid = repositories.id で同期書き込み
```

### Web フロー(読み取り)

```
ブラウザ
  ↓ 最初のアクセス
Worker → dist/client/index.html を返す
  ↓
React アプリ起動
  ↓ fetch(同一オリジン)
Hono API ルート(同じ Worker)
  ↓
D1 クエリ(一覧 or FTS5 全文検索)
  ↓
JSON レスポンス
  ↓
React がカード描画・無限スクロール
```

### FTS5 の紐付け

外部キー制約なし。`repositories_fts` の `rowid` を `repositories.id` と一致させ、検索結果から `repositories` へ JOIN する。整合性は Worker のコードで担保。

```sql
-- 挿入例
INSERT INTO repositories_fts(rowid, url, description, summary, detailed_summary)
VALUES (1, 'https://...', '...', '...', '...');

-- 検索例
SELECT r.* FROM repositories r
JOIN repositories_fts ON r.id = repositories_fts.rowid
WHERE repositories_fts MATCH 'rust async';
```

---

## 現在の実装状況

### 完了済み

| ファイル | 内容 |
|--|--|
| `src/server/db/schema.ts` | 新スキーマ(`repositories` / `repository_summaries` / `repository_detailed_summaries` / `repository_readmes`)の Drizzle 定義済み |
| `drizzle/migrations/0000_peaceful_polaris.sql` | 旧スキーマ(`url` PK)から新スキーマ(`id` PK)への移行スクリプト済み |
| `drizzle/migrations/0001_repositories_fts.sql` | FTS5 仮想テーブル(`repositories_fts`)の作成マイグレーション済み |
| `src/server/ai/summarizer.ts` | 短め要約(`generateSummary`)・詳細要約(`generateDetailedSummary`)の生成ロジック実装済み(Workers AI 呼び出し・フォールバック処理あり) |
| `src/server/crawler/scraper.ts` | GitHub Trending スクレイピング実装済み。`TrendItem` 型をここで定義・export |
| `src/server/crawler/github.ts` | README 取得(main / master ブランチ fallback)実装済み |
| `src/server/lib/readme-normalizer.ts` | README の Markdown 正規化処理実装済み |
| `src/server/lib/repository.ts` | Drizzle ORM で全面書き直し済み。`saveOrUpdateRepository` / `getRepositories` を実装。`getRepositories` は `detailedSummary` も JOIN して返す。FTS5 同期処理(`db.run(sql\`...\`)`)を含む |
| `src/server/router/index.ts` | Hono API ルート。`basePath('/api')` で `/api/repositories`(一覧・ページネーション・言語フィルタ) / `/api/repositories/search`(FTS5 全文検索)を実装 |
| `src/server/schedule/index.ts` | Cron ハンドラ。Discord 通知を削除済み。短め要約・詳細要約を `Promise.all` で並列生成し `saveOrUpdateRepository` へ渡す。両方揃っている場合のみキャッシュ再利用 |
| `src/server/index.ts` | 統合エンドポイント。`fetch`(Hono) + `scheduled`(Cron)を export。`AppType` をここで export |
| `test/repository.test.ts` | `saveOrUpdateRepository` / `getRepositories` の統合テスト(13件) |
| `test/fts.test.ts` | FTS5 同期の統合テスト(5件) |
| `test/api.test.ts` | Hono API ルートの統合テスト(8件) |
| `wrangler.jsonc` | `LANGUAGES` を `"typescript,rust,python,all"` に修正。`"all"` が全言語(言語フィルタなし)を表すと明示 |
| `wrangler.test.jsonc` | テスト専用 wrangler 設定(AI リモート接続なし・`test/worker.ts` を main に使用) |
| `knip.json` | 未使用コード検出設定。`test/worker.ts` をエントリに追加、自動生成 `.d.ts` を ignore、Cloudflare 仮想モジュールを `ignoreDependencies` に追加 |

### 未実装

| 対象 | 備考 |
|--|--|
| React フロントエンド | `src/client/App.tsx` がデフォルトテンプレートのまま |
| `repository_readmes` テーブルの削除 | 移行完了後に削除。README 本文は今後保存しない |

---

## 今後やること

1. **React フロントエンド構築** — `src/client/App.tsx` を実装。`hc<AppType>` で型安全な API 呼び出し。無限スクロール・言語フィルタ・全文検索・ソート切り替えを実装

## UI/UX 構成案

### 画面レイアウト(デスクトップ版)

```text
+--------------------------------------------------------------------------------+
|  [Logo] Ghrender       [ 検索ボックス (検索 プレースホルダ) ]  |
+--------------------------------------------------------------------------------+
|  [フィルタ] DB(trend_configs)から動的生成  ( ) All  ( ) TypeScript  ( ) Rust   |
|  [ソート]   (v) 最近のトレンド  ( ) スター数  ( ) トレンド入り回数             |
+--------------------------------------------------------------------------------+
|                                                                                |
|  +-----------------------------------+  +-----------------------------------+  |
|  | [Repo] user/repo                  |  | [Repo] user/repo2                 |  |
|  | [Star] 12.3k   [Trend] 5回        |  | [Star] 8.5k    [Trend] 2回        |  |
|  | [Lang] TypeScript                 |  | [Lang] Rust                       |  |
|  |                                   |  |                                   |  |
|  | 短い要約：ここにリポジトリの...   |  | 短い要約：ここに別のリポジトリ... |  |
|  |                                   |  |                                   |  |
|  | [ v 詳細を見る (トグルボタン) ]   |  | [ v 詳細を見る (トグルボタン) ]   |  |
|  +-----------------------------------+  +-----------------------------------+  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 画面レイアウト(モバイル版)

```text
+--------------------------------------+
| [Logo] Trending Notifier             |
+--------------------------------------+
| [検索ボックス...]                    |
+--------------------------------------+
| [フィルタ ▼] [ソート ▼]              |
+--------------------------------------+
|                                      |
| +----------------------------------+ |
| | [Repo] user/repo                 | |
| | [Star] 12.3k | [Trend] 5回       | |
| | [Lang] TypeScript                | |
| |                                  | |
| | 短い要約が表示されます...        | |
| |                                  | |
| | [ v 詳細を見る ]                 | |
| +----------------------------------+ |
+--------------------------------------+
```
