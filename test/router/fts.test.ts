import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';
import { saveOrUpdateRepository } from '../../src/server/lib/repository';
import * as schema from '../../src/server/db/schema';
import { drizzle } from 'drizzle-orm/d1';

const db = () => drizzle(env.DB, { schema });

const baseRepo = {
  url: 'https://github.com/test/repo',
  description: 'A fast async runtime for Rust',
  language: 'Rust',
  stars: 500,
} as const;

const anotherRepo = {
  url: 'https://github.com/other/project',
  description: 'Python web framework',
  language: 'Python',
  stars: 200,
} as const;

afterEach(async () => {
  const d = db();
  await d.delete(schema.repositoryDetailedSummaries);
  await d.delete(schema.repositorySummaries);
  await d.delete(schema.repositoryReadmes);
  await d.delete(schema.repositories);
  await env.DB.prepare('DELETE FROM repositories_fts').run();
});

describe('FTS5 同期', () => {
  describe('正常系', () => {
    describe('挿入時の同期', () => {
      it('リポジトリを保存したとき、URL で FTS5 検索にヒットすること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);

        // FTS5 の unicode61 トークナイザは . / を区切り文字として扱うため
        // "https://github.com/test/repo" → github, com, test, repo 等にトークン分割される
        const { results } = await env.DB.prepare(
          `SELECT r.url FROM repositories r
           JOIN repositories_fts ON r.id = repositories_fts.rowid
           WHERE repositories_fts MATCH ?`,
        )
          .bind('url:github')
          .all<{ url: string }>();

        expect(results).toHaveLength(1);
        expect(results[0].url).toBe(baseRepo.url);
      });

      it('リポジトリを保存したとき、説明文で FTS5 検索にヒットすること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);

        const { results } = await env.DB.prepare(
          `SELECT r.url FROM repositories r
           JOIN repositories_fts ON r.id = repositories_fts.rowid
           WHERE repositories_fts MATCH ?`,
        )
          .bind('async')
          .all<{ url: string }>();

        expect(results).toHaveLength(1);
        expect(results[0].url).toBe(baseRepo.url);
      });
    });

    describe('更新時の同期', () => {
      it('要約を更新したとき、新しい要約テキストで FTS5 検索にヒットすること', async () => {
        // FTS5 unicode61 トークナイザは日本語を分割できないため ASCII テキストで検証する
        await saveOrUpdateRepository(env.DB, baseRepo, {
          summary: 'initial summary text',
        });
        await saveOrUpdateRepository(env.DB, baseRepo, {
          summary: 'updated summary content',
        });

        const { results } = await env.DB.prepare(
          `SELECT r.url FROM repositories r
           JOIN repositories_fts ON r.id = repositories_fts.rowid
           WHERE repositories_fts MATCH ?`,
        )
          .bind('updated')
          .all<{ url: string }>();

        expect(results).toHaveLength(1);
        expect(results[0].url).toBe(baseRepo.url);
      });

      it('詳細要約を更新したとき、新しい詳細要約テキストで FTS5 検索にヒットすること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo, {
          detailedSummary: 'initial detailed summary',
        });
        await saveOrUpdateRepository(env.DB, baseRepo, {
          detailedSummary: 'updated detailed content',
        });

        const { results } = await env.DB.prepare(
          `SELECT r.url FROM repositories r
           JOIN repositories_fts ON r.id = repositories_fts.rowid
           WHERE repositories_fts MATCH ?`,
        )
          .bind('updated')
          .all<{ url: string }>();

        expect(results).toHaveLength(1);
        expect(results[0].url).toBe(baseRepo.url);
      });
    });

    describe('検索の精度', () => {
      it('別のリポジトリのキーワードで検索したとき、対象外のリポジトリがヒットしないこと', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);
        await saveOrUpdateRepository(env.DB, anotherRepo);

        const { results } = await env.DB.prepare(
          `SELECT r.url FROM repositories r
           JOIN repositories_fts ON r.id = repositories_fts.rowid
           WHERE repositories_fts MATCH ?`,
        )
          .bind('Python')
          .all<{ url: string }>();

        expect(results).toHaveLength(1);
        expect(results[0].url).toBe(anotherRepo.url);
      });
    });
  });
});
