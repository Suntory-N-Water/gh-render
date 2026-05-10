import { type SQL, and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import * as schema from '../db/schema';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SORT_COLUMNS = {
  lastUpdatedAt: schema.repositories.lastUpdatedAt,
  stars: schema.repositories.stars,
  updateCount: schema.repositories.updateCount,
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

const router = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .get('/repositories', async (c) => {
    const { offset, limit, language, sort } = c.req.query();

    const offsetNum = Number(offset) || 0;
    const limitNum = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const sortKey: SortKey =
      sort in SORT_COLUMNS ? (sort as SortKey) : 'lastUpdatedAt';

    const db = drizzle(c.env.DB, { schema });
    const repoColumns = getTableColumns(schema.repositories);

    const conditions: SQL[] = [];
    if (language) {
      conditions.push(eq(schema.repositories.language, language));
    }

    const rows = await db
      .select({
        ...repoColumns,
        summary: schema.repositorySummaries.summary,
        detailedSummary: schema.repositoryDetailedSummaries.detailedSummary,
      })
      .from(schema.repositories)
      .leftJoin(
        schema.repositorySummaries,
        eq(schema.repositories.id, schema.repositorySummaries.repositoryId),
      )
      .leftJoin(
        schema.repositoryDetailedSummaries,
        eq(
          schema.repositories.id,
          schema.repositoryDetailedSummaries.repositoryId,
        ),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(SORT_COLUMNS[sortKey]))
      .limit(limitNum + 1)
      .offset(offsetNum);

    const hasNext = rows.length > limitNum;
    const repositories = hasNext ? rows.slice(0, limitNum) : rows;

    return c.json({ repositories, hasNext });
  })
  .get('/repositories/search', async (c) => {
    const { q } = c.req.query();

    if (!q || q.trim() === '') {
      return c.json({ repositories: [] });
    }

    const db = drizzle(c.env.DB, { schema });
    const repoColumns = getTableColumns(schema.repositories);

    const rows = await db
      .select({
        ...repoColumns,
        summary: schema.repositorySummaries.summary,
        detailedSummary: schema.repositoryDetailedSummaries.detailedSummary,
      })
      .from(schema.repositories)
      .leftJoin(
        schema.repositorySummaries,
        eq(schema.repositories.id, schema.repositorySummaries.repositoryId),
      )
      .leftJoin(
        schema.repositoryDetailedSummaries,
        eq(
          schema.repositories.id,
          schema.repositoryDetailedSummaries.repositoryId,
        ),
      )
      .where(
        sql`${schema.repositories.id} IN (
          SELECT rowid FROM repositories_fts WHERE repositories_fts MATCH ${q}
        )`,
      );

    return c.json({ repositories: rows });
  });

export default router;
