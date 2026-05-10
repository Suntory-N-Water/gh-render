import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../src/server/router';
import * as schema from '../../src/server/db/schema';
import { saveOrUpdateRepository } from '../../src/server/lib/repository';

const db = () => drizzle(env.DB, { schema });

afterEach(async () => {
  const d = db();
  await d.delete(schema.repositoryDetailedSummaries);
  await d.delete(schema.repositorySummaries);
  await d.delete(schema.repositoryReadmes);
  await d.delete(schema.repositories);
  vi.useRealTimers();
});

const seed = async (
  overrides: Partial<{
    url: string;
    description: string;
    language: string;
    stars: number;
  }> = {},
  summary?: string,
) =>
  saveOrUpdateRepository(
    env.DB,
    {
      url: 'https://github.com/test/repo',
      description: 'Test repository',
      language: 'TypeScript',
      stars: 100,
      ...overrides,
    },
    summary ? { summary } : undefined,
  );

describe('リポジトリ一覧取得 API', () => {
  describe('正常系', () => {
    it('登録済みリポジトリが全件返ること', async () => {
      await seed({ url: 'https://github.com/test/repo1' });
      await seed({ url: 'https://github.com/test/repo2' });

      const res = await app.request('/api/repositories', {}, env);

      expect(res.status).toBe(200);
      const body = await res.json<{ repositories: { url: string }[] }>();
      expect(body.repositories).toHaveLength(2);
    });

    it('lastUpdatedAt 降順で返ること', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      await seed({ url: 'https://github.com/test/repo-old' });

      vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
      await seed({ url: 'https://github.com/test/repo-new' });

      const res = await app.request('/api/repositories', {}, env);
      const body = await res.json<{ repositories: { url: string }[] }>();

      expect(body.repositories[0].url).toBe('https://github.com/test/repo-new');
      expect(body.repositories[1].url).toBe('https://github.com/test/repo-old');
    });

    describe('detailedSummary', () => {
      it('詳細要約があるとき、detailedSummary が返ること', async () => {
        await saveOrUpdateRepository(
          env.DB,
          {
            url: 'https://github.com/test/repo',
            description: 'Test',
            language: 'TypeScript',
            stars: 100,
          },
          { summary: '短い要約', detailedSummary: '詳細要約' },
        );

        const res = await app.request('/api/repositories', {}, env);
        const body = await res.json<{
          repositories: { detailedSummary: string | null }[];
        }>();

        expect(body.repositories[0].detailedSummary).toBe('詳細要約');
      });
    });
  });
});
