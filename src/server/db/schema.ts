import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const repositories = sqliteTable('repositories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').unique().notNull(),
  description: text('description').notNull().default(''),
  language: text('language').notNull().default(''),
  stars: integer('stars').notNull().default(0),
  firstNotifiedAt: integer('first_notified_at', {
    mode: 'timestamp',
  }).notNull(),
  lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp' }).notNull(),
  updateCount: integer('update_count').notNull().default(1),
});

export const repositorySummaries = sqliteTable('repository_summaries', {
  repositoryId: integer('repository_id')
    .primaryKey()
    .references(() => repositories.id),
  summary: text('summary').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const repositoryDetailedSummaries = sqliteTable(
  'repository_detailed_summaries',
  {
    repositoryId: integer('repository_id')
      .primaryKey()
      .references(() => repositories.id),
    detailedSummary: text('detailed_summary').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
);

// 移行用の一時テーブル。移行完了後に削除する
export const repositoryReadmes = sqliteTable('repository_readmes', {
  repositoryId: integer('repository_id')
    .primaryKey()
    .references(() => repositories.id),
  readme: text('readme').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type RepositorySummary = typeof repositorySummaries.$inferSelect;
export type NewRepositorySummary = typeof repositorySummaries.$inferInsert;
export type RepositoryDetailedSummary =
  typeof repositoryDetailedSummaries.$inferSelect;
export type NewRepositoryDetailedSummary =
  typeof repositoryDetailedSummaries.$inferInsert;
export type RepositoryReadme = typeof repositoryReadmes.$inferSelect;
export type NewRepositoryReadme = typeof repositoryReadmes.$inferInsert;
