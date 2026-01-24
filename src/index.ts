import { fetchRepositoryReadme } from './github';
import { getLogger } from './logger';
import { createDiscordAdapter } from './notification';
import { getRepositories, saveOrUpdateRepository } from './repository';
import { fetchTrendingRepositories } from './scraper';
import { generateSummary } from './summarizer';
import type {
  NotificationAdapter,
  NotificationContent,
  TrendItem,
} from './types';

const logger = getLogger('scheduler');

// 言語別の取得件数設定
const LANGUAGE_CONFIG = [
  { language: 'typescript', limit: 3 },
  { language: 'rust', limit: 3 },
  { language: 'python', limit: 3 },
  { language: '', limit: 5 }, // 全言語
];

export default {
  /**
   * Cronトリガーによって定期実行されるハンドラ
   */
  async scheduled(_event, env, _ctx): Promise<void> {
    logger.info('Starting scheduled task');

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.trim() === '') {
      logger.warn(
        'DISCORD_WEBHOOK_URL is not set or empty. Notifications will be mocked.',
      );
    }

    const notificationAdapter =
      webhookUrl && webhookUrl.trim() !== ''
        ? createDiscordAdapter(webhookUrl)
        : createMockAdapter();

    // 全言語のトレンドを収集
    const allItems: Array<{
      label: string;
      items: (TrendItem & { summary: string })[];
    }> = [];

    for (const config of LANGUAGE_CONFIG) {
      const result = await processLanguage({
        targetLanguage: config.language,
        limit: config.limit,
        env,
      });
      if (result.items.length > 0) {
        allItems.push(result);
      }
    }

    // 1通にまとめて通知
    if (allItems.length > 0) {
      await sendConsolidatedNotification({
        adapter: notificationAdapter,
        allItems,
      });
    } else {
      logger.info('No trending repositories to notify');
    }

    logger.info('Scheduled task completed');
  },
} satisfies ExportedHandler<Env>;

/**
 * README取得と要約生成を行います
 * エラー時はdescriptionにフォールバック
 */
async function fetchAndSummarize({
  item,
  ai,
}: {
  item: TrendItem;
  ai: Ai;
}): Promise<string> {
  try {
    const [owner, repo] = item.name.split('/');
    const readme = await fetchRepositoryReadme({ owner, repo });

    if (!readme) {
      return item.description;
    }

    return await generateSummary({
      ai,
      name: item.name,
      description: item.description,
      readme,
    });
  } catch (e) {
    logger.error({ repo: item.name, err: e }, 'Failed to fetch and summarize');
    return item.description;
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
  env: Env;
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
    const existingRepos = await getRepositories({ db: env.DB, urls });

    // 3. 各リポジトリの要約を取得(キャッシュ or 新規生成)
    const enrichedItems = await Promise.all(
      trends.map(async (item) => {
        const existing = existingRepos.get(item.url);

        // キャッシュがあれば再利用
        if (existing?.summary) {
          logger.debug({ repo: item.name }, 'Using cached summary');
          await saveOrUpdateRepository({
            db: env.DB,
            item,
            summary: existing.summary,
          });
          return { ...item, summary: existing.summary };
        }

        // 新規: README取得 → AI要約
        const summary = await fetchAndSummarize({ item, ai: env.AI });

        // DB保存
        await saveOrUpdateRepository({
          db: env.DB,
          item,
          summary,
        });

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
 * 言語ごとに個別に通知を送信
 */
async function sendConsolidatedNotification({
  adapter,
  allItems,
}: {
  adapter: NotificationAdapter;
  allItems: Array<{
    label: string;
    items: (TrendItem & { summary: string })[];
  }>;
}): Promise<void> {
  // 言語ごとに個別のWebhook通知を送信
  for (const { label, items } of allItems) {
    const languageTitle =
      label === 'all'
        ? 'GitHub Trending Daily (All Languages)'
        : `GitHub Trending Daily (${label.charAt(0).toUpperCase() + label.slice(1)})`;

    const content: NotificationContent = {
      title: languageTitle,
      items,
    };

    await adapter.send(content);

    // Discord API rate limitを避けるため、各言語の送信間に待機時間を追加
    if (allItems.indexOf({ label, items }) < allItems.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Webhook URLが設定されていない場合に使用するMockアダプタ
 */
function createMockAdapter(): NotificationAdapter {
  return {
    async send(content: NotificationContent): Promise<void> {
      logger.info(
        { title: content.title, itemCount: content.items.length },
        '[MOCK] Notification would be sent',
      );
      for (const item of content.items) {
        logger.debug(
          { name: item.name, summary: item.summary },
          '[MOCK] Item detail',
        );
      }
    },
  };
}
