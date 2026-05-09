CREATE TABLE repositories_new (
  url TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'Unknown',
  repository_description TEXT NOT NULL DEFAULT '',
  readme_content TEXT,
  summary TEXT,
  first_notified_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  previous_stars INTEGER NOT NULL,
  update_count INTEGER DEFAULT 1
);

INSERT INTO repositories_new (
  url,
  language,
  repository_description,
  readme_content,
  summary,
  first_notified_at,
  last_updated_at,
  previous_stars,
  update_count
)
SELECT
  url,
  'Unknown',
  '',
  NULL,
  summary,
  first_notified_at,
  last_updated_at,
  previous_stars,
  update_count
FROM repositories;

DROP TABLE repositories;

ALTER TABLE repositories_new RENAME TO repositories;
