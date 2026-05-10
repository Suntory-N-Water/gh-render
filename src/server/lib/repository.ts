import { eq, inArray, sql } from 'drizzle-orm';
import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type RepoInput = {
  url: string;
  description: string;
  language: string;
  stars: number;
};

type SummaryInput = {
  summary?: string;
  detailedSummary?: string;
};

export type RepositoryWithSummary = schema.Repository & {
  summary: string | null;
  detailedSummary: string | null;
};

export async function saveOrUpdateRepository(
  d1: D1Database,
  repo: RepoInput,
  summaries?: SummaryInput,
): Promise<void> {
  const db = drizzle(d1, { schema });
  const now = new Date();

  await db
    .insert(schema.repositories)
    .values({
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      firstNotifiedAt: now,
      lastUpdatedAt: now,
      updateCount: 1,
    })
    .onConflictDoUpdate({
      target: schema.repositories.url,
      set: {
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        lastUpdatedAt: now,
        updateCount: sql`${schema.repositories.updateCount} + 1`,
      },
    });

  const saved = await db.query.repositories.findFirst({
    where: eq(schema.repositories.url, repo.url),
    columns: { id: true },
  });
  if (!saved) {
    return;
  }

  if (summaries?.summary) {
    await db
      .insert(schema.repositorySummaries)
      .values({ repositoryId: saved.id, summary: summaries.summary })
      .onConflictDoUpdate({
        target: schema.repositorySummaries.repositoryId,
        set: { summary: summaries.summary, updatedAt: now },
      });
  }

  if (summaries?.detailedSummary) {
    await db
      .insert(schema.repositoryDetailedSummaries)
      .values({
        repositoryId: saved.id,
        detailedSummary: summaries.detailedSummary,
      })
      .onConflictDoUpdate({
        target: schema.repositoryDetailedSummaries.repositoryId,
        set: { detailedSummary: summaries.detailedSummary, updatedAt: now },
      });
  }
}

export async function getRepositories(
  d1: D1Database,
  urls: string[],
): Promise<Map<string, RepositoryWithSummary>> {
  if (urls.length === 0) {
    return new Map();
  }

  const db = drizzle(d1, { schema });
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
    .where(inArray(schema.repositories.url, urls));

  const map = new Map<string, RepositoryWithSummary>();
  for (const row of rows) {
    map.set(row.url, row);
  }
  return map;
}
