DROP TABLE IF EXISTS repositories;
CREATE TABLE IF NOT EXISTS repositories (
  url TEXT PRIMARY KEY,
  summary TEXT,
  first_notified_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  previous_stars INTEGER NOT NULL,
  update_count INTEGER DEFAULT 1
);
