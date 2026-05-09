import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRepositories,
  saveOrUpdateRepository,
} from '../../src/server/lib/repository';
import * as schema from '../../src/server/db/schema';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';

const db = () => drizzle(env.DB, { schema });

const baseRepo = {
  url: 'https://github.com/test/repo',
  description: 'テスト用リポジトリ',
  language: 'TypeScript',
  stars: 100,
} as const;

afterEach(async () => {
  const d = db();
  await d.delete(schema.repositoryDetailedSummaries);
  await d.delete(schema.repositorySummaries);
  await d.delete(schema.repositoryReadmes);
  await d.delete(schema.repositories);
  vi.useRealTimers();
});

describe('リポジトリの保存', () => {
  describe('正常系', () => {
    describe('新規リポジトリ', () => {
      it('保存したとき、repositories テーブルにレコードが存在すること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);

        const sut = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        expect(sut).toBeDefined();
        expect(sut?.url).toBe(baseRepo.url);
        expect(sut?.description).toBe(baseRepo.description);
        expect(sut?.language).toBe(baseRepo.language);
        expect(sut?.stars).toBe(baseRepo.stars);
      });

      it('要約ありで保存したとき、repository_summaries にレコードが存在すること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo, {
          summary: 'テスト用要約',
        });

        const repo = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });
        const sut = await db().query.repositorySummaries.findFirst({
          where: eq(schema.repositorySummaries.repositoryId, repo?.id),
        });

        expect(sut?.summary).toBe('テスト用要約');
      });

      it('詳細要約ありで保存したとき、repository_detailed_summaries にレコードが存在すること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo, {
          detailedSummary: 'テスト用詳細要約',
        });

        const repo = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });
        const sut = await db().query.repositoryDetailedSummaries.findFirst({
          where: eq(schema.repositoryDetailedSummaries.repositoryId, repo?.id),
        });

        expect(sut?.detailedSummary).toBe('テスト用詳細要約');
      });

      it('要約なしで保存したとき、repository_summaries にレコードが存在しないこと', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);

        const repo = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });
        const sut = await db().query.repositorySummaries.findFirst({
          where: eq(schema.repositorySummaries.repositoryId, repo?.id),
        });

        expect(sut).toBeUndefined();
      });

      it('保存したとき、first_notified_at と last_updated_at が設定されること', async () => {
        // D1 の timestamp モードは Unix 秒で保存されるため秒単位に切り捨てて比較する
        const beforeSec = Math.floor(Date.now() / 1000) * 1000;
        await saveOrUpdateRepository(env.DB, baseRepo);
        const afterSec = (Math.floor(Date.now() / 1000) + 1) * 1000;

        const sut = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        expect(sut?.firstNotifiedAt.getTime()).toBeGreaterThanOrEqual(
          beforeSec,
        );
        expect(sut?.firstNotifiedAt.getTime()).toBeLessThanOrEqual(afterSec);
        expect(sut?.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(beforeSec);
      });
    });

    describe('既存リポジトリの再保存', () => {
      it('同じ URL で再保存したとき、update_count が1増加すること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo);
        await saveOrUpdateRepository(env.DB, baseRepo);

        const sut = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        expect(sut?.updateCount).toBe(2);
      });

      it('同じ URL で再保存したとき、last_updated_at が更新されること', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

        await saveOrUpdateRepository(env.DB, baseRepo);

        vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));

        await saveOrUpdateRepository(env.DB, baseRepo);

        const sut = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        expect(sut?.lastUpdatedAt).toEqual(new Date('2024-01-02T00:00:00Z'));
      });

      it('同じ URL で再保存したとき、first_notified_at が変わらないこと', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

        await saveOrUpdateRepository(env.DB, baseRepo);

        const firstSave = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));

        await saveOrUpdateRepository(env.DB, baseRepo);

        const sut = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });

        expect(sut?.firstNotifiedAt).toEqual(firstSave?.firstNotifiedAt);
      });

      it('要約がある状態で要約なしの再保存をしたとき、既存の要約が保持されること', async () => {
        await saveOrUpdateRepository(env.DB, baseRepo, {
          summary: '既存の要約',
        });
        await saveOrUpdateRepository(env.DB, baseRepo);

        const repo = await db().query.repositories.findFirst({
          where: eq(schema.repositories.url, baseRepo.url),
        });
        const sut = await db().query.repositorySummaries.findFirst({
          where: eq(schema.repositorySummaries.repositoryId, repo?.id),
        });

        expect(sut?.summary).toBe('既存の要約');
      });
    });
  });
});

describe('リポジトリの一括取得', () => {
  describe('正常系', () => {
    it('複数 URL を指定したとき、存在する URL のレコードのみ返ること', async () => {
      await saveOrUpdateRepository(env.DB, {
        ...baseRepo,
        url: 'https://github.com/test/repo1',
      });
      await saveOrUpdateRepository(env.DB, {
        ...baseRepo,
        url: 'https://github.com/test/repo2',
      });

      const sut = await getRepositories(env.DB, [
        'https://github.com/test/repo1',
        'https://github.com/test/repo2',
      ]);

      expect(sut.size).toBe(2);
      expect(sut.has('https://github.com/test/repo1')).toBe(true);
      expect(sut.has('https://github.com/test/repo2')).toBe(true);
    });

    it('存在しない URL を含む配列を渡したとき、存在する URL のみ返ること', async () => {
      await saveOrUpdateRepository(env.DB, baseRepo);

      const sut = await getRepositories(env.DB, [
        baseRepo.url,
        'https://github.com/nonexistent/repo',
      ]);

      expect(sut.size).toBe(1);
      expect(sut.has(baseRepo.url)).toBe(true);
      expect(sut.has('https://github.com/nonexistent/repo')).toBe(false);
    });

    it('要約ありで保存したリポジトリを取得したとき、summary が含まれること', async () => {
      await saveOrUpdateRepository(env.DB, baseRepo, {
        summary: '取得テスト用要約',
      });

      const sut = await getRepositories(env.DB, [baseRepo.url]);

      expect(sut.get(baseRepo.url)?.summary).toBe('取得テスト用要約');
    });
  });

  describe('異常系', () => {
    it('空の URL 配列を渡したとき、空の Map が返ること', async () => {
      const sut = await getRepositories(env.DB, []);

      expect(sut.size).toBe(0);
    });
  });
});
