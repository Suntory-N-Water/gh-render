import { type SQL, and, desc, eq, getTableColumns, lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import * as schema from '../db/schema';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const router = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .get('/repositories', async (c) => {
    const { cursor, limit, language } = c.req.query();

    if (cursor !== undefined && Number.isNaN(Number(cursor))) {
      return c.json({ error: 'Invalid cursor' }, 400);
    }

    const limitNum = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const db = drizzle(c.env.DB, { schema });
    const repoColumns = getTableColumns(schema.repositories);

    const conditions: SQL[] = [];
    if (cursor) {
      conditions.push(
        lt(schema.repositories.lastUpdatedAt, new Date(Number(cursor))),
      );
    }
    if (language) {
      conditions.push(eq(schema.repositories.language, language));
    }

    const rows = await db
      .select({
        ...repoColumns,
        summary: schema.repositorySummaries.summary,
      })
      .from(schema.repositories)
      .leftJoin(
        schema.repositorySummaries,
        eq(schema.repositories.id, schema.repositorySummaries.repositoryId),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.repositories.lastUpdatedAt))
      .limit(limitNum + 1);

    const hasNext = rows.length > limitNum;
    const repositories = hasNext ? rows.slice(0, limitNum) : rows;
    const nextCursor = hasNext
      ? repositories[repositories.length - 1].lastUpdatedAt.getTime()
      : undefined;

    return c.json({ repositories, nextCursor });
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
      })
      .from(schema.repositories)
      .leftJoin(
        schema.repositorySummaries,
        eq(schema.repositories.id, schema.repositorySummaries.repositoryId),
      )
      .where(
        sql`${schema.repositories.id} IN (
          SELECT rowid FROM repositories_fts WHERE repositories_fts MATCH ${q}
        )`,
      );

    return c.json({ repositories: rows });
  });

export default router;
