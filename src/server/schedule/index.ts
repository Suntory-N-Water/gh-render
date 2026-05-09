import { generateSummary } from '../ai/summarizer';
import { fetchRepositoryReadme } from '../crawler/github';
import { fetchTrendingRepositories } from '../crawler/scraper';
import { getLogger } from '../lib/logger';
import { normalizeReadmeMarkdown } from '../lib/readme-normalizer';
import { getRepositories, saveOrUpdateRepository } from '../lib/repository';
import type { TrendItem } from '../types';

const logger = getLogger('scheduler');

export default {
  /**
   * Cronトリガーによって定期実行されるハンドラ
   */
  async scheduled(_event, env, _ctx): Promise<void> {
    logger.info('Starting scheduled task');

    // 環境変数から言語設定を読み込み
    const languageConfig = loadLanguageConfig(env);

    // 全言語のトレンドを収集
    const allItems: Array<{
      label: string;
      items: (TrendItem & { summary: string })[];
    }> = [];

    for (const config of languageConfig) {
      const result = await processLanguage({
        targetLanguage: config.language,
        limit: config.limit,
        env,
      });
      if (result.items.length > 0) {
        allItems.push(result);
      }
    }

    logger.info('Scheduled task completed');
  },
} satisfies ExportedHandler<CloudflareBindings>;

/**
 * README取得と要約生成を行います
 * エラー時は説明文にフォールバック
 */
async function fetchAndSummarize({
  item,
  ai,
}: {
  item: TrendItem;
  ai: Ai;
}): Promise<{ summary: string; readmeContent: string | null }> {
  try {
    const [owner, repo] = item.name.split('/');
    const readme = await fetchRepositoryReadme({ owner, repo });

    if (!readme) {
      return { summary: item.description, readmeContent: null };
    }

    const normalizedReadme = normalizeReadmeMarkdown(readme);
    if (normalizedReadme === '') {
      return { summary: item.description, readmeContent: null };
    }

    const summary = await generateSummary({
      ai,
      name: item.name,
      description: item.description,
      readme: normalizedReadme,
    });

    return { summary, readmeContent: normalizedReadme };
  } catch (e) {
    logger.error({ repo: item.name, err: e }, 'Failed to fetch and summarize');
    return { summary: item.description, readmeContent: null };
  }
}

/**
 * 特定の言語のトレンドを処理します
 */
async function processLanguage({
  targetLanguage,
  limit,
  env,
}: {
  targetLanguage: string;
  limit: number;
  env: CloudflareBindings;
}): Promise<{ label: string; items: (TrendItem & { summary: string })[] }> {
  const label = targetLanguage || 'all';
  logger.info({ lang: label, limit }, 'Processing language');

  try {
    // 1. トレンド取得(件数制限)
    const allTrends = await fetchTrendingRepositories(targetLanguage);
    const trends = allTrends.slice(0, limit);
    logger.info(
      { lang: label, fetched: allTrends.length, using: trends.length },
      'Fetched trending repos',
    );

    // 2. DBから既存データを一括取得
    const urls = trends.map((t) => t.url);
    const existingRepos = await getRepositories(env.DB, urls);

    // 3. 各リポジトリの要約を取得(キャッシュ or 新規生成)
    const enrichedItems = await Promise.all(
      trends.map(async (item) => {
        const existing = existingRepos.get(item.url);
        const repoInput = {
          url: item.url,
          description: item.description,
          language: item.language,
          stars: item.stars,
        };

        // キャッシュがあれば再利用
        if (existing?.summary) {
          logger.debug({ repo: item.name }, 'Using cached summary');
          await saveOrUpdateRepository(env.DB, repoInput, {
            summary: existing.summary,
          });
          return { ...item, summary: existing.summary };
        }

        // 新規: README取得 → AI要約
        const { summary } = await fetchAndSummarize({
          item,
          ai: env.AI,
        });

        // DB保存
        await saveOrUpdateRepository(env.DB, repoInput, { summary });

        return { ...item, summary };
      }),
    );

    return { label, items: enrichedItems };
  } catch (error) {
    logger.error({ lang: label, err: error }, 'Error processing language');
    return { label, items: [] };
  }
}

/**
 * 環境変数から言語設定を読み込む
 */
function loadLanguageConfig(
  env: CloudflareBindings,
): Array<{ language: string; limit: number }> {
  const languages = env.LANGUAGES.split(',');
  const limits = env.LIMITS.split(',').map(Number);

  if (languages.length !== limits.length) {
    throw new Error(
      `LANGUAGES and LIMITS length mismatch: ${languages.length} vs ${limits.length}`,
    );
  }

  return languages.map((language, index) => ({
    language,
    limit: limits[index],
  }));
}
