export type Repository = {
  url: string;
  summary: string | null;
  first_notified_at: number;
  last_updated_at: number;
  previous_stars: number;
  update_count: number;
};

export type TrendItem = {
  name: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  starsToday: number;
};

export type NotificationContent = {
  title: string;
  items: (TrendItem & { summary: string })[];
};

export type NotificationAdapter = {
  send(content: NotificationContent): Promise<void>;
};
