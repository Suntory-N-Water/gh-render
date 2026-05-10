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
  await env.DB.prepare('DELETE FROM repositories_fts').run();
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
    describe('ページネーション', () => {
      it('offset なしのとき、先頭からデータが返ること', async () => {
        await seed({ url: 'https://github.com/test/repo1' });
        await seed({ url: 'https://github.com/test/repo2' });

        const res = await app.request('/api/repositories', {}, env);

        expect(res.status).toBe(200);
        const body = await res.json<{ repositories: unknown[] }>();
        expect(body.repositories).toHaveLength(2);
      });

      it('offset を渡したとき、続きのデータが返ること', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        await seed({ url: 'https://github.com/test/repo-old' });

        vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));
        await seed({ url: 'https://github.com/test/repo-new' });

        const first = await app.request('/api/repositories?limit=1', {}, env);
        const { repositories } = await first.json<{
          repositories: { url: string }[];
          hasNext: boolean;
        }>();

        expect(repositories[0].url).toBe('https://github.com/test/repo-new');

        const second = await app.request(
          '/api/repositories?limit=1&offset=1',
          {},
          env,
        );
        const body = await second.json<{ repositories: { url: string }[] }>();

        expect(body.repositories).toHaveLength(1);
        expect(body.repositories[0].url).toBe(
          'https://github.com/test/repo-old',
        );
      });

      it('limit を超えるデータが存在するとき、limit 件数のデータと hasNext=true が返ること', async () => {
        for (let i = 0; i < 5; i += 1) {
          await seed({ url: `https://github.com/test/repo${i}` });
        }

        const res = await app.request('/api/repositories?limit=3', {}, env);
        const body = await res.json<{
          repositories: unknown[];
          hasNext: boolean;
        }>();

        expect(body.repositories).toHaveLength(3);
        expect(body.hasNext).toBe(true);
      });

      it('最終ページのとき hasNext=false が返ること', async () => {
        await seed({ url: 'https://github.com/test/repo1' });
        await seed({ url: 'https://github.com/test/repo2' });

        const res = await app.request('/api/repositories?limit=5', {}, env);
        const body = await res.json<{ hasNext: boolean }>();

        expect(body.hasNext).toBe(false);
      });
    });

    describe('ソート', () => {
      it('sort=stars のとき、スター数降順で返ること', async () => {
        await seed({ url: 'https://github.com/test/low-star', stars: 10 });
        await seed({ url: 'https://github.com/test/high-star', stars: 999 });

        const res = await app.request('/api/repositories?sort=stars', {}, env);
        const body = await res.json<{
          repositories: { url: string; stars: number }[];
        }>();

        expect(body.repositories[0].stars).toBe(999);
        expect(body.repositories[1].stars).toBe(10);
      });
    });

    describe('言語フィルタ', () => {
      it('言語を指定したとき、その言語のリポジトリのみ返ること', async () => {
        await seed({
          url: 'https://github.com/test/ts-repo',
          language: 'TypeScript',
        });
        await seed({
          url: 'https://github.com/test/rust-repo',
          language: 'Rust',
        });

        const res = await app.request(
          '/api/repositories?language=Rust',
          {},
          env,
        );
        const body = await res.json<{ repositories: { language: string }[] }>();

        expect(body.repositories).toHaveLength(1);
        expect(body.repositories[0].language).toBe('Rust');
      });

      it('存在しない言語を指定したとき、空の結果が返ること', async () => {
        await seed({ language: 'TypeScript' });

        const res = await app.request(
          '/api/repositories?language=Cobol',
          {},
          env,
        );
        const body = await res.json<{ repositories: unknown[] }>();

        expect(body.repositories).toHaveLength(0);
      });
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

describe('全文検索 API', () => {
  describe('正常系', () => {
    it('検索キーワードに一致するリポジトリが存在するとき、該当リポジトリが返ること', async () => {
      await seed(
        {
          url: 'https://github.com/test/rust-repo',
          description: 'A fast async runtime',
        },
        'blazing fast performance',
      );

      const res = await app.request(
        '/api/repositories/search?q=blazing',
        {},
        env,
      );
      const body = await res.json<{ repositories: { url: string }[] }>();

      expect(res.status).toBe(200);
      expect(body.repositories).toHaveLength(1);
      expect(body.repositories[0].url).toBe(
        'https://github.com/test/rust-repo',
      );
    });

    it('どのリポジトリにも一致しないキーワードで検索したとき、空の結果が返ること', async () => {
      await seed({ description: 'TypeScript library' });

      const res = await app.request(
        '/api/repositories/search?q=nonexistentterm',
        {},
        env,
      );
      const body = await res.json<{ repositories: unknown[] }>();

      expect(body.repositories).toHaveLength(0);
    });
  });
});
