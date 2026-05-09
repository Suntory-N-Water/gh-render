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
| `drizzle/migrations/` | 旧スキーマ(`url` PK)から新スキーマ(`id` PK)への移行スクリプト済み |
| `src/server/ai/summarizer.ts` | 短め要約の生成ロジック実装済み(Workers AI 呼び出し・フォールバック処理あり) |
| `src/server/crawler/scraper.ts` | GitHub Trending スクレイピング実装済み |
| `src/server/crawler/github.ts` | README 取得(main / master ブランチ fallback)実装済み |
| `src/server/lib/readme-normalizer.ts` | README の Markdown 正規化処理実装済み |

### 未動作(スキーマ乖離)

新スキーマへの移行後、以下のファイルが旧スキーマのまま放置されており動作しない。

| ファイル | 問題 |
|--|--|
| `src/server/types.ts` | `Repository` 型が旧カラム名(`repository_description`・`readme_content`・`previous_stars`・`summary`)を持つ。`db/schema.ts` が型をエクスポートしているため不要 |
| `src/server/lib/repository.ts` | 旧カラム名を直接 SQL で参照。新テーブル(`repository_summaries` 等)への読み書き未対応。Drizzle ORM 未使用 |
| `src/server/index.ts` | `saveOrUpdateRepository` を呼び出しているため上記の問題を引き継ぐ。`starsToday` をスクレイピングしているが DB に保存していない |

### 未実装

| 対象 | 備考 |
|--|--|
| 詳細要約生成(2段階目) | `summarizer.ts` は短め要約のみ。`repository_detailed_summaries` への書き込みなし |
| FTS5 テーブル | マイグレーション未作成・Cron への同期処理なし |
| Hono API ルート | `src/server/index.ts` に `scheduled` ハンドラのみ。HTTP ルートなし |
| React フロントエンド | `src/client/App.tsx` がデフォルトテンプレートのまま |
| Discord 通知の削除 | `src/server/lib/notification.ts`・`types.ts` の `NotificationAdapter`/`NotificationContent` が残存 |

---

## 実装の進め方

1. pnpm モノレポへ移行
2. Hono で API ルート(リポジトリ一覧・検索)を追加
3. React + Vite でフロントエンドを構築
4. `repositories_fts` FTS5 仮想テーブルをマイグレーションで追加し、Cron の書き込み処理に同期ロジックを組み込む
5. AI 要約プロンプト改善(詳細要約の構造化フォーマット対応)
6. Discord 通知コードの削除
7. `repository_readmes` テーブルの削除

---

## UI/UX 構成案

### 画面レイアウト(デスクトップ版)

```text
+--------------------------------------------------------------------------------+
|  [Logo] GitHub Trending Notifier       [ 検索ボックス (検索 プレースホルダ) ]  |
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
