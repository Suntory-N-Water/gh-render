import { getLogger } from './logger';
import type { NotificationAdapter, NotificationContent } from './types';

const logger = getLogger('notification');

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

      // Discord Embedsの制限（1メッセージあたり10個まで）を考慮し、必要なら分割送信のリスクがあるが
      // 今回はトップ3件程度を想定しているため、1リクエストで送信する。
      // もし大量に送る場合は分割ロジックが必要。

      const embeds = content.items.map((item) => ({
        title: item.name,
        url: item.url,
        description: item.summary,
        color: 0x0099ff, // 青色
        fields: [
          {
            name: 'Language',
            value: item.language || 'Unknown',
            inline: true,
          },
          {
            name: 'Stars',
            value: `${item.stars.toLocaleString()} (+${item.starsToday.toLocaleString()})`,
            inline: true,
          },
        ],
        footer: {
          text: 'Trending Now',
        },
      }));

      const payload = {
        content: `**${content.title}**`,
        embeds: embeds,
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

        logger.info('Notification sent successfully');
      } catch (error) {
        logger.error({ err: error }, 'Failed to send notification');
        throw error;
      }
    },
  };
}
