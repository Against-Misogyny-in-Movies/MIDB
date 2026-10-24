import { pgTable, uuid, text, smallint, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { movies } from './movie';
import { users } from './auth';

export const metricKind = pgEnum('metric_kind', ['bechdel', 'unconsenting', 'ddd']);

export const communityMetricSubmissions = pgTable('community_metric_submissions', {
	id: uuid('id').defaultRandom().primaryKey(),
	movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	metric: metricKind('metric').notNull(),
	value: smallint('value').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
	uniqueIndex('cms_user_movie_metric_idx').on(t.userId, t.movieId, t.metric),
	index('cms_movie_metric_idx').on(t.movieId, t.metric),
	index('cms_user_created_idx').on(t.userId, t.createdAt),
]);

export const comments = pgTable('comments', {
	id: uuid('id').defaultRandom().primaryKey(),
	movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
	index('comments_movie_idx').on(t.movieId, t.createdAt),
	index('comments_user_idx').on(t.userId, t.createdAt),
]);
