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

// 監視対象の言語リスト ("" は全言語)
const TARGET_LANGUAGES = ['', 'typescript'];

export default {
  /**
   * Cronトリガーによって定期実行されるハンドラ
   */
  async scheduled(_event, env, _ctx): Promise<void> {
    logger.info('Starting scheduled task');

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    // 空文字または空白のみの場合も弾く
    if (!webhookUrl || webhookUrl.trim() === '') {
      logger.warn(
        'DISCORD_WEBHOOK_URL is not set or empty. Notifications will be mocked.',
      );
    }

    // 通知アダプタの初期化 (URLがない場合はMock動作)
    // ここでも同様のチェックを行い、有効なURLがある場合のみDiscordアダプタを作成
    const notificationAdapter =
      webhookUrl && webhookUrl.trim() !== ''
        ? createDiscordAdapter(webhookUrl)
        : createMockAdapter();

    for (const lang of TARGET_LANGUAGES) {
      await processLanguage({ targetLanguage: lang, env, notificationAdapter });
    }

    logger.info('Scheduled task completed');
  },
} satisfies ExportedHandler<Env>;

/**
 * 特定の言語のトレンドを処理します
 */
async function processLanguage({
  targetLanguage,
  env,
  notificationAdapter,
}: {
  targetLanguage: string;
  env: Env;
  notificationAdapter: NotificationAdapter;
}) {
  const label = targetLanguage || 'all';
  logger.info({ lang: label }, 'Processing language');

  try {
    // 1. トレンド取得
    const trends = await fetchTrendingRepositories(targetLanguage);
    logger.info(
      { lang: label, count: trends.length },
      'Fetched trending repos',
    );

    // 2. DBから既存データを一括取得
    const urls = trends.map((t) => t.url);
    const existingRepos = await getRepositories({ db: env.DB, urls });

    // 3. 新規ランクインのリポジトリを特定
    const newItems: TrendItem[] = [];
    for (const item of trends) {
      if (!existingRepos.has(item.url)) {
        newItems.push(item);
      }
    }

    if (newItems.length === 0) {
      logger.info({ lang: label }, 'No new trending repositories found');
      return;
    }

    logger.info(
      { lang: label, count: newItems.length },
      'Found new repositories',
    );

    // 4. 新規アイテムの処理 (README取得 -> 要約 -> 通知データ構築)
    // 並列処理で高速化
    const enrichedItems = await Promise.all(
      newItems.map(async (item) => {
        let summary: string | undefined;

        try {
          // README取得
          const readme = await fetchRepositoryReadme({
            owner: item.name.split('/')[0],
            repo: item.name.split('/')[1],
          });

          if (readme) {
            // AI要約
            summary = await generateSummary({
              ai: env.AI,
              name: item.name,
              description: item.description,
              readme,
            });
          }
        } catch (e) {
          logger.error({ repo: item.name, err: e }, 'Failed to enrich item');
        }

        // DB保存
        await saveOrUpdateRepository({
          db: env.DB,
          item,
          summary,
        });

        // summaryをitemに付加して返す
        return {
          ...item,
          // NotificationContentのitemsは { summary: string } が必須になったため、
          // 確実に文字列を入れる (summaryがない場合は description を使用)
          summary: summary || item.description,
        };
      }),
    );

    // 5. 通知
    await notificationAdapter.send({
      title: `GitHub Trending (${label})`,
      items: enrichedItems,
    });
  } catch (error) {
    logger.error({ lang: label, err: error }, 'Error processing language');
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
      // 詳細な内容をデバッグログに出力
      for (const item of content.items) {
        logger.debug(
          { name: item.name, summary: item.summary },
          '[MOCK] Item detail',
        );
      }
    },
  };
}
