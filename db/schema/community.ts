import {
	sqliteTable,
	text,
	integer,
	check,
	index,
	primaryKey,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { titles } from './titles.ts';
import { users } from './auth.ts';
import { enumCheck, timestamps, umFlagColumns } from './columns.ts';

// One table per metric shape, so each can hold what it names.

export const communityBechdelRatings = sqliteTable(
	'community_bechdel_ratings',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: text('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		rating: integer('rating').notNull(),
		...timestamps()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.titleId] }),
		index('cbr_title_idx').on(t.titleId),
		check('cbr_rating_range', sql`${t.rating} >= 0 AND ${t.rating} <= 3`)
	]
);

export const communityUmReports = sqliteTable(
	'community_um_reports',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: text('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		...umFlagColumns(),
		...timestamps()
	},
	(t) => [primaryKey({ columns: [t.userId, t.titleId] }), index('cur_title_idx').on(t.titleId)]
);

/** Per-topic DDD vote; season/episode are null for whole-title votes, which `cdv_vote_uniq` treats as equal
 * (drizzle-kit splits an expression on commas, so the null-to-`-1` mapping is a CASE, not coalesce). */
export const communityDddVotes = sqliteTable(
	'community_ddd_votes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: text('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		topicId: integer('topic_id').notNull(),
		season: integer('season'),
		episode: integer('episode'),
		yes: integer('yes', { mode: 'boolean' }).notNull(),
		...timestamps()
	},
	(t) => [
		uniqueIndex('cdv_vote_uniq').on(
			t.userId,
			t.titleId,
			t.topicId,
			sql`CASE WHEN ${t.season} IS NULL THEN -1 ELSE ${t.season} END`,
			sql`CASE WHEN ${t.episode} IS NULL THEN -1 ELSE ${t.episode} END`
		),
		index('cdv_title_topic_idx').on(t.titleId, t.topicId)
	]
);

export const commentStatus = ['visible', 'hidden', 'deleted'] as const;

export const comments = sqliteTable(
	'comments',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		titleId: text('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		status: text('status', { enum: commentStatus }).notNull().default('visible'),
		...timestamps()
	},
	(t) => [
		index('comments_title_idx').on(t.titleId, t.createdAt),
		index('comments_user_idx').on(t.userId, t.createdAt),
		check('comments_body_length', sql`length(${t.body}) BETWEEN 1 AND 5000`),
		enumCheck('comments_status_check', t.status, commentStatus)
	]
);
