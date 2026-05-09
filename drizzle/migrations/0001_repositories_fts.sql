-- repositories_fts: FTS5 仮想テーブル
-- rowid を repositories.id と対応させ、Worker の書き込み処理で手動同期する
-- content='' (contentless) は DELETE 非対応のため通常の FTS5 テーブルとして作成する
CREATE VIRTUAL TABLE IF NOT EXISTS `repositories_fts` USING fts5(
  url,
  description,
  summary,
  detailed_summary
);
