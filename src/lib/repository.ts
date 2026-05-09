import type { Repository, TrendItem } from '../types';

/**
 * リポジトリ情報をデータベースに保存または更新します。
 */
export async function saveOrUpdateRepository({
  db,
  item,
  summary,
  readmeContent,
}: {
  db: D1Database;
  item: TrendItem;
  summary?: string;
  readmeContent?: string | null;
}): Promise<void> {
  const existing = await getRepository({ db, url: item.url });

  const now = Date.now();

  if (existing) {
    // 更新
    await db
      .prepare(
        `UPDATE repositories SET
          language = ?,
          repository_description = ?,
          readme_content = COALESCE(?, readme_content),
          last_updated_at = ?,
          previous_stars = ?,
          update_count = update_count + 1,
          summary = COALESCE(?, summary)
        WHERE url = ?`,
      )
      .bind(
        item.language,
        item.description,
        readmeContent ?? null,
        now,
        item.stars,
        summary || null,
        item.url,
      )
      .run();
  } else {
    // 新規作成
    await db
      .prepare(
        `INSERT INTO repositories (
          url,
          language,
          repository_description,
          readme_content,
          summary,
          first_notified_at,
          last_updated_at,
          previous_stars,
          update_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        item.url,
        item.language,
        item.description,
        readmeContent ?? null,
        summary || null,
        now,
        now,
        item.stars,
      )
      .run();
  }
}

/**
 * URLを指定してリポジトリ情報を取得します。
 * @param params パラメータオブジェクト
 * @param params.db D1データベース
 * @param params.url リポジトリURL
 * @returns リポジトリ情報(存在しない場合はnull)
 */
async function getRepository({
  db,
  url,
}: {
  db: D1Database;
  url: string;
}): Promise<Repository | null> {
  return await db
    .prepare('SELECT * FROM repositories WHERE url = ?')
    .bind(url)
    .first<Repository>();
}

/**
 * 複数のURLを指定してリポジトリ情報を一括取得します。
 */
export async function getRepositories({
  db,
  urls,
}: {
  db: D1Database;
  urls: string[];
}): Promise<Map<string, Repository>> {
  if (urls.length === 0) {
    return new Map();
  }

  // D1は `IN (?)` のバインドを配列展開してくれないため、プレースホルダーを動的に生成
  const placeholders = urls.map(() => '?').join(',');
  const query = `SELECT * FROM repositories WHERE url IN (${placeholders})`;

  const { results } = await db
    .prepare(query)
    .bind(...urls)
    .all<Repository>();

  const map = new Map<string, Repository>();
  for (const repo of results) {
    map.set(repo.url, repo);
  }

  return map;
}
