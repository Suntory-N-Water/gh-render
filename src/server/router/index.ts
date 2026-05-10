import { desc, eq, getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import * as schema from '../db/schema';

const router = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .get('/repositories', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const repoColumns = getTableColumns(schema.repositories);

    const repositories = await db
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
      .orderBy(desc(schema.repositories.lastUpdatedAt));

    return c.json({ repositories });
  });

export default router;
