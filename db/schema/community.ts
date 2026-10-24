import {
	pgTable,
	pgEnum,
	uuid,
	text,
	smallint,
	integer,
	boolean,
	check,
	index,
	primaryKey,
	unique
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { titles } from './titles';
import { users } from './auth';
import { timestamps, umFlagColumns } from './columns';

// One table per metric shape, so each can hold what it names.

export const communityBechdelRatings = pgTable(
	'community_bechdel_ratings',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: uuid('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		rating: smallint('rating').notNull(),
		...timestamps()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.titleId] }),
		index('cbr_title_idx').on(t.titleId),
		check('cbr_rating_range', sql`${t.rating} >= 0 AND ${t.rating} <= 3`)
	]
);

export const communityUmReports = pgTable(
	'community_um_reports',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: uuid('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		...umFlagColumns(),
		...timestamps()
	},
	(t) => [primaryKey({ columns: [t.userId, t.titleId] }), index('cur_title_idx').on(t.titleId)]
);

/** Per-topic DDD vote; season/episode are null for whole-title votes (PG >= 15 for NULLS NOT DISTINCT). */
export const communityDddVotes = pgTable(
	'community_ddd_votes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		titleId: uuid('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		topicId: integer('topic_id').notNull(),
		season: integer('season'),
		episode: integer('episode'),
		yes: boolean('yes').notNull(),
		...timestamps()
	},
	(t) => [
		unique('cdv_vote_uniq')
			.on(t.userId, t.titleId, t.topicId, t.season, t.episode)
			.nullsNotDistinct(),
		index('cdv_title_topic_idx').on(t.titleId, t.topicId)
	]
);

export const commentStatus = pgEnum('comment_status', ['visible', 'hidden', 'deleted']);

export const comments = pgTable(
	'comments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		titleId: uuid('title_id')
			.notNull()
			.references(() => titles.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		status: commentStatus('status').notNull().default('visible'),
		...timestamps()
	},
	(t) => [
		index('comments_title_idx').on(t.titleId, t.createdAt),
		index('comments_user_idx').on(t.userId, t.createdAt),
		check('comments_body_length', sql`char_length(${t.body}) BETWEEN 1 AND 5000`)
	]
);
