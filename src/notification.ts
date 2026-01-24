import { getLogger } from './logger';
import type { NotificationAdapter, NotificationContent } from './types';

const logger = getLogger('notification');

/**
 * 言語別の色を返します
 */
function getLanguageColor(language: string): number {
  const colors: Record<string, number> = {
    TypeScript: 0x3178c6,
    Python: 0x3776ab,
    Rust: 0xdea584,
  };
  return colors[language] || 0x0099ff; // デフォルトは青
}

/**
 * Discord通知アダプタを作成します。
 * @param webhookUrl Discord Webhook URL
 * @returns 通知アダプタ
 */
export function createDiscordAdapter(webhookUrl: string): NotificationAdapter {
  return {
    async send(content: NotificationContent): Promise<void> {
      logger.info(
        { title: content.title, count: content.items.length },
        'Sending notification to Discord',
      );

      if (content.items.length === 0) {
        logger.info('No items to notify');
        return;
      }

      // Discordの制限は10 embedsまで。安全のため最大10件ずつまとめて送信
      const MAX_EMBEDS_PER_MESSAGE = 10;
      const chunks: (typeof content.items)[] = [];

      for (let i = 0; i < content.items.length; i += MAX_EMBEDS_PER_MESSAGE) {
        chunks.push(content.items.slice(i, i + MAX_EMBEDS_PER_MESSAGE));
      }

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        const embeds = chunk.map((item, indexInChunk) => {
          const rank = chunkIndex * MAX_EMBEDS_PER_MESSAGE + indexInChunk + 1;
          return {
            title: `#${rank} ${item.name}`,
            url: item.url,
            description: item.summary,
            color: getLanguageColor(item.language),
            fields: [
              {
                name: 'Language',
                value: item.language || 'Unknown',
                inline: true,
              },
              {
                name: 'Stars',
                value: `⭐ ${item.stars.toLocaleString()} (+${item.starsToday.toLocaleString()} today)`,
                inline: true,
              },
            ],
          };
        });

        const payload = {
          content: chunkIndex === 0 ? `# ${content.title}\n` : undefined,
          embeds,
        };

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Discord Webhook failed: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          logger.info(
            {
              chunkIndex: chunkIndex + 1,
              totalChunks: chunks.length,
              itemsInChunk: chunk.length,
            },
            'Notification chunk sent',
          );

          // Discord API rate limitを避けるため、チャンク間で待機
          if (chunkIndex < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (error) {
          logger.error(
            { err: error, chunkIndex },
            'Failed to send notification',
          );
          throw error;
        }
      }

      logger.info('All notifications sent successfully');
    },
  };
}
