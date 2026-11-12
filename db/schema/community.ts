import {
	sqliteTable,
	text,
	integer,
	check,
	index,
	primaryKey,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { titles } from './titles.ts';
import { users } from './auth.ts';
import { createdAt, enumCheck, timestamps, umFlagColumns } from './columns.ts';
import {
	COMMENT_BODY_MAX,
	MODERATION_REASON_MAX,
	REPORT_NOTE_MAX,
	commentStatus,
	moderationAction,
	moderationSource,
	reportReason,
	reportStatus
} from '../lib/comments.ts';

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

/**
 * A comment on a title. A root has no `parent_id`; a reply names the comment it answers in
 * `parent_id` and its thread's root in `root_id`, so a reply to a reply stays in the root's
 * thread and the UI can say whom it answers. `score` is the sum of the comment's votes and
 * `reply_count` the number of published replies (to this comment as `parent_id`, and in the
 * whole thread for a root); both are kept in step with the writes that change them
 * (`#lib/server/data/comment-status.ts`, `comment-votes.ts`).
 */
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
		parentId: text('parent_id').references((): AnySQLiteColumn => comments.id, {
			onDelete: 'cascade'
		}),
		rootId: text('root_id').references((): AnySQLiteColumn => comments.id, {
			onDelete: 'cascade'
		}),
		body: text('body').notNull(),
		status: text('status', { enum: commentStatus }).notNull().default('pending'),
		score: integer('score').notNull().default(0),
		replyCount: integer('reply_count').notNull().default(0),
		editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
		moderationSource: text('moderation_source', { enum: moderationSource }),
		moderationReason: text('moderation_reason'),
		/** The classifier's verdict as JSON text (Phase 5); null until one ran. */
		aiVerdict: text('ai_verdict'),
		...timestamps()
	},
	(t) => [
		index('comments_title_status_created_idx').on(t.titleId, t.status, t.createdAt),
		index('comments_title_status_score_idx').on(t.titleId, t.status, t.score),
		index('comments_root_idx').on(t.rootId, t.createdAt),
		index('comments_user_idx').on(t.userId, t.createdAt),
		check(
			'comments_body_length',
			sql`length(${t.body}) BETWEEN 1 AND ${sql.raw(String(COMMENT_BODY_MAX))}`
		),
		check(
			'comments_reason_length',
			sql`length(${t.moderationReason}) <= ${sql.raw(String(MODERATION_REASON_MAX))}`
		),
		check('comments_ai_verdict_json', sql`${t.aiVerdict} IS NULL OR json_valid(${t.aiVerdict})`),
		enumCheck('comments_status_check', t.status, commentStatus),
		enumCheck('comments_source_check', t.moderationSource, moderationSource)
	]
);

/** One vote per user per comment: +1 or -1. Changing or removing a vote rewrites or deletes the row. */
export const commentVotes = sqliteTable(
	'comment_votes',
	{
		commentId: text('comment_id')
			.notNull()
			.references(() => comments.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		value: integer('value').notNull(),
		...timestamps()
	},
	(t) => [
		primaryKey({ columns: [t.commentId, t.userId] }),
		index('comment_votes_user_idx').on(t.userId),
		check('comment_votes_value', sql`${t.value} IN (-1, 1)`)
	]
);

/** A reader's report of a comment. One per reporter per comment; three open ones send it back to review. */
export const commentReports = sqliteTable(
	'comment_reports',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		commentId: text('comment_id')
			.notNull()
			.references(() => comments.id, { onDelete: 'cascade' }),
		reporterId: text('reporter_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		reason: text('reason', { enum: reportReason }).notNull(),
		note: text('note'),
		status: text('status', { enum: reportStatus }).notNull().default('open'),
		resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
		...timestamps()
	},
	(t) => [
		uniqueIndex('comment_reports_uniq').on(t.commentId, t.reporterId),
		index('comment_reports_status_idx').on(t.commentId, t.status),
		enumCheck('comment_reports_reason_check', t.reason, reportReason),
		enumCheck('comment_reports_status_check', t.status, reportStatus),
		check(
			'comment_reports_note_length',
			sql`length(${t.note}) <= ${sql.raw(String(REPORT_NOTE_MAX))}`
		)
	]
);

/**
 * What a moderator did, kept after the comment or user it targets is gone (the foreign keys
 * set null), so the log stays whole.
 */
export const moderationActions = sqliteTable(
	'moderation_actions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
		targetCommentId: text('target_comment_id').references(() => comments.id, {
			onDelete: 'set null'
		}),
		targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action', { enum: moderationAction }).notNull(),
		reason: text('reason'),
		/** The length of a mute, in hours; null on every other action. */
		muteHours: integer('mute_hours'),
		createdAt: createdAt()
	},
	(t) => [
		index('moderation_actions_created_idx').on(t.createdAt),
		index('moderation_actions_comment_idx').on(t.targetCommentId),
		enumCheck('moderation_actions_action_check', t.action, moderationAction),
		check('moderation_actions_mute_hours', sql`${t.muteHours} IS NULL OR ${t.muteHours} > 0`),
		check(
			'moderation_actions_reason_length',
			sql`length(${t.reason}) <= ${sql.raw(String(MODERATION_REASON_MAX))}`
		)
	]
);
