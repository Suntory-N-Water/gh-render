# GitHubトレンドリポジトリ日次配信システム - 実装プラン

## プロジェクト概要

GitHubのトレンドリポジトリを自動収集し、AIで要約してDiscordに日次配信するシステム。

## 技術スタック

- **実行環境**: Cloudflare Workers + Cron Triggers
- **言語**: TypeScript
- **データベース**: Cloudflare D1
- **AI**: Cloudflare AI (初期実装、将来的に切替可能)
- **配信先**: Discord Webhook (Adapterパターンで抽象化)
- **デプロイ**: GitHub Actions

## 決定事項

### 実行仕様
- **実行時刻**: 毎日JST朝7時 (UTC 22時)
- **対象言語**: TypeScript, Rust, Python
- **トレンド期間**: daily固定
- **取得元**: `https://github.com/trending`

### 配信内容
1通のメッセージに以下を含める:
- TypeScriptトップ3件 (AI要約あり)
- Pythonトップ3件 (AI要約あり)
- Rustトップ3件 (AI要約あり)
- 全言語トレンド5件 (AI要約あり)

**重複処理**: 重複してもそのまま表示（シンプル優先）

### 配信情報
各リポジトリについて:
- リポジトリ名 + URL
- Star数 + 今日のStar増加数
- AI要約 (2-3行形式)

### データベース設計

**テーブル: repositories**

```sql
CREATE TABLE IF NOT EXISTS repositories (
  url TEXT PRIMARY KEY,
  summary TEXT,
  first_notified_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  previous_stars INTEGER NOT NULL,
  update_count INTEGER DEFAULT 1
);
```

- URL: 一意識別子
- summary: AI要約キャッシュ
- first_notified_at: 初回配信日時
- last_updated_at: 最終更新日時
- previous_stars: 前回Star数
- update_count: 更新回数

### 動作フロー

```
Cron Trigger (毎日UTC 22時)
  ↓
スクレイピング (TypeScript/Rust/Python各3件、全言語5件)
  ↓
各リポジトリのREADME取得 (raw.githubusercontent.com経由、APIレート制限なし)
  ↓
D1で既配信チェック
  - 初回: AI要約 + DB登録
  - 既配信: Star数更新のみ (AI要約はキャッシュ利用)
  ↓
Discord Embed形式でメッセージ構築
  ↓
Discord Webhook送信
```

### README取得方法
- GitHub APIを使わず、`https://raw.githubusercontent.com/{owner}/{repo}/main/README.md` から直接取得
- レート制限なし、認証不要
- main/master ブランチの自動判定が必要

### AI要約
- **プロバイダー**: Cloudflare AI
- **出力形式**: 2-3行
- **切替方式**: if分岐のシンプルな関数
- **README取得失敗時**: AI要約なしで配信継続

### エラーハンドリング
- **リトライ**: あり (最大3回、指数バックオフ)
- **README取得失敗**: 要約なしで配信継続
- **ログ**: 自作ロガー使用

### 設定管理
- **Webhook URL**: Cloudflare Secrets
- **対象言語リスト**: wrangler.jsonc

### プロジェクト構造
- **単一ファイル**: `src/index.ts` にすべての処理を記述
- **テストコード**: 不要 (手動テスト)
- **README**: 簡潔な説明のみ

### 配信フォーマット
Discord Embedのカード形式

### 配信先抽象化
NotificationAdapter インターフェースを定義し、DiscordAdapterを実装。将来Slack対応可能。

## 実装時に決定する項目

- プロジェクト配置場所
- README取得範囲（実装後に実測して調整）
- デフォルトブランチの判定方法（main/master等）
- 自作ロガーの詳細
- AI要約プロンプトの最終調整
