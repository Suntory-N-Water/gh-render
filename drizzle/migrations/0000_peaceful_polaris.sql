-- 旧スキーマ(url TEXT PRIMARY KEY)から新スキーマ(id INTEGER PRIMARY KEY AUTOINCREMENT)へ移行する。
-- 新規DBでも既存DBでも安全に動作する:
--   新規DB → CREATE IF NOT EXISTS で空の旧スキーマテーブルを作成 → INSERT 0件 → 新スキーマに再作成
--   既存DB → CREATE IF NOT EXISTS がスキップ → 既存データを移行

-- 1. 旧スキーマテーブルを確実に存在させる(新規DBではここで作成)
CREATE TABLE IF NOT EXISTS `repositories` (
  `url` text PRIMARY KEY NOT NULL,
  `language` text NOT NULL DEFAULT 'Unknown',
  `repository_description` text NOT NULL DEFAULT '',
  `readme_content` text,
  `summary` text,
  `first_notified_at` integer NOT NULL DEFAULT 0,
  `last_updated_at` integer NOT NULL DEFAULT 0,
  `previous_stars` integer NOT NULL DEFAULT 0,
  `update_count` integer DEFAULT 1
);
--> statement-breakpoint
-- 2. 旧データを一時テーブルに退避
CREATE TABLE `_repositories_migration_temp` (
  `url` text PRIMARY KEY NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `language` text NOT NULL DEFAULT '',
  `stars` integer NOT NULL DEFAULT 0,
  `readme_content` text,
  `summary` text,
  `first_notified_at` integer NOT NULL DEFAULT 0,
  `last_updated_at` integer NOT NULL DEFAULT 0,
  `update_count` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint
INSERT INTO `_repositories_migration_temp` (
  `url`, `description`, `language`, `stars`,
  `readme_content`, `summary`,
  `first_notified_at`, `last_updated_at`, `update_count`
)
SELECT
  `url`,
  COALESCE(`repository_description`, ''),
  COALESCE(`language`, ''),
  COALESCE(`previous_stars`, 0),
  `readme_content`,
  `summary`,
  `first_notified_at`,
  `last_updated_at`,
  COALESCE(`update_count`, 1)
FROM `repositories`;
--> statement-breakpoint
-- 3. 旧テーブルを削除して新スキーマで再作成
DROP TABLE `repositories`;
--> statement-breakpoint
CREATE TABLE `repositories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `url` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `language` text DEFAULT '' NOT NULL,
  `stars` integer DEFAULT 0 NOT NULL,
  `first_notified_at` integer NOT NULL,
  `last_updated_at` integer NOT NULL,
  `update_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_url_unique` ON `repositories` (`url`);
--> statement-breakpoint
-- 4. 退避データを新テーブルに移行
INSERT INTO `repositories` (
  `url`, `description`, `language`, `stars`,
  `first_notified_at`, `last_updated_at`, `update_count`
)
SELECT
  `url`, `description`, `language`, `stars`,
  `first_notified_at`, `last_updated_at`, `update_count`
FROM `_repositories_migration_temp`;
--> statement-breakpoint
-- 5. repository_summaries テーブルを作成して既存 summary を移行
CREATE TABLE `repository_summaries` (
  `repository_id` integer PRIMARY KEY NOT NULL,
  `summary` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `repository_summaries` (`repository_id`, `summary`)
SELECT r.`id`, m.`summary`
FROM `repositories` r
JOIN `_repositories_migration_temp` m ON r.`url` = m.`url`
WHERE m.`summary` IS NOT NULL AND m.`summary` != '';
--> statement-breakpoint
-- 6. repository_detailed_summaries テーブルを作成(データなし・Cronで順次生成)
CREATE TABLE `repository_detailed_summaries` (
  `repository_id` integer PRIMARY KEY NOT NULL,
  `detailed_summary` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- 7. repository_readmes テーブルを作成して既存 readme_content を移行
CREATE TABLE `repository_readmes` (
  `repository_id` integer PRIMARY KEY NOT NULL,
  `readme` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `repository_readmes` (`repository_id`, `readme`)
SELECT r.`id`, m.`readme_content`
FROM `repositories` r
JOIN `_repositories_migration_temp` m ON r.`url` = m.`url`
WHERE m.`readme_content` IS NOT NULL AND m.`readme_content` != '';
--> statement-breakpoint
-- 8. 一時テーブルを削除
DROP TABLE `_repositories_migration_temp`;
