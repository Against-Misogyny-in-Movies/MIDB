import { and, asc, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import {
	comments,
	communityContentReports as reports,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import { titles } from '#db/schema/titles.ts';
import { purgeTitleReports } from '#lib/server/http/purge-title.ts';
import { CONCERN_FLAGS, type ConcernFlagKey } from '#lib/media/utils/readerReports.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { runBatch, type BatchStatement } from './comment-status.ts';
import { QUEUE_LIMIT } from './moderation-queue.ts';
import type { UserRow } from './user-queries.ts';

type Action = (typeof moderationAction)[number];
type ReportRow = typeof reports.$inferSelect;
export type TitleRef = {
	kind: (typeof titles.$inferSelect)['kind'];
	tmdbId: number | null;
	name: string;
};

export type ReportModerationResult =
	| { ok: true; titles: TitleRef[] }
	| { ok: false; reason: 'not-found' | 'invalid-state' };

/** A report's answers as stored: the level columns, the eight flags (null is not sure) and the framing. */
export type ReportAnswerColumns = Pick<
	ReportRow,
	| 'sexualPresent'
	| 'partnerLevel'
	| 'physicalLevel'
	| 'stalkingLevel'
	| 'objectificationLevel'
	| 'framing'
	| ConcernFlagKey
>;

/** The account behind a report, as context for the moderator's decision. */
export type ReportAccount = {
	userId: string;
	username: string | null;
	/** When the account was created (ISO), so the age shows as of now. */
	createdAt: string;
	/** The account's reports that are not rejected, on every title. */
	reportCount: number;
	/** The comments the account has written in all. */
	commentCount: number;
};

export type HeldReport = {
	titleId: string;
	title: TitleRef;
	account: ReportAccount;
	holdReason: ReportRow['holdReason'];
	createdAt: string;
	answers: ReportAnswerColumns;
	/** UM's concern flags for the title, only when the hold reason is `contradicts_source` and the title has a UM binding. */
	um: Record<ConcernFlagKey, boolean> | null;
};

export type TitleReport = {
	account: ReportAccount;
	status: ReportRow['status'];
	holdReason: ReportRow['holdReason'];
	createdAt: string;
	answers: ReportAnswerColumns;
};

export type FlaggedTitle = {
	titleId: string;
	title: TitleRef;
	flags: { id: string; note: string | null; reporter: string | null; createdAt: string }[];
};

const answerSelect = {
	sexualPresent: reports.sexualPresent,
	partnerLevel: reports.partnerLevel,
	physicalLevel: reports.physicalLevel,
	stalkingLevel: reports.stalkingLevel,
	objectificationLevel: reports.objectificationLevel,
	framing: reports.framing,
	...Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, reports[f.key]]))
} as { [K in keyof ReportAnswerColumns]: (typeof reports)[K] };

const titleSelect = { kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title };

/**
 * The log row for an action on reader reports, written only while a report matching `where`
 * exists, so a lost race leaves neither a status change nor a log line. It is one row, naming
 * the report's account and, unless `withTitle` is false, its title.
 */
function logReportAction(
	actorId: string,
	action: Action,
	where: SQL,
	withTitle = true
): BatchStatement {
	return db.insert(moderationActions).select(
		db
			.select({
				id: sql<string>`${crypto.randomUUID()}`.as('id'),
				actorId: sql<string>`${actorId}`.as('actorId'),
				targetCommentId: sql<string | null>`NULL`.as('targetCommentId'),
				targetUserId: reports.userId,
				targetTitleId: withTitle ? reports.titleId : sql<string | null>`NULL`.as('targetTitleId'),
				action: sql<Action>`${action}`.as('action'),
				reason: sql<string | null>`NULL`.as('reason'),
				muteHours: sql<number | null>`NULL`.as('muteHours'),
				createdAt: sql<number>`${Date.now()}`.as('createdAt')
			})
			.from(reports)
			.where(where)
			.limit(1)
	);
}

/** Moves one report between statuses, logging it, in one batch; the purge follows. */
async function moveReport(
	actor: UserRow,
	userId: string,
	titleId: string,
	action: Action,
	spec: { from: ReportRow['status'][]; to: ReportRow['status'] }
): Promise<ReportModerationResult> {
	const [found] = await db
		.select({ status: reports.status, title: titleSelect })
		.from(reports)
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(and(eq(reports.userId, userId), eq(reports.titleId, titleId)));
	if (!found) return { ok: false, reason: 'not-found' };
	if (!spec.from.includes(found.status)) return { ok: false, reason: 'invalid-state' };

	const where = and(
		eq(reports.userId, userId),
		eq(reports.titleId, titleId),
		inArray(reports.status, spec.from)
	);
	const results = await runBatch([
		logReportAction(actor.id, action, where as SQL),
		db
			.update(reports)
			.set({ status: spec.to, holdReason: null, updatedAt: sql`${reports.updatedAt}` })
			.where(where)
			.returning({ userId: reports.userId })
	]);
	const moved = results[1];
	if (!Array.isArray(moved) || moved.length === 0) return { ok: false, reason: 'invalid-state' };
	purgeTitleReports(found.title);
	return { ok: true, titles: [found.title] };
}

/** Counts a held or rejected report: it joins the title's counts, and its hold reason is cleared. */
export const approveReport = (actor: UserRow, userId: string, titleId: string) =>
	moveReport(actor, userId, titleId, 'approve_report', {
		from: ['held', 'rejected'],
		to: 'counted'
	});

/** Rejects a held or counted report: it leaves the counts, and the reader sees it as not counted. */
export const rejectReport = (actor: UserRow, userId: string, titleId: string) =>
	moveReport(actor, userId, titleId, 'reject_report', {
		from: ['held', 'counted'],
		to: 'rejected'
	});

/** The titles an account has reports on, for a purge of their counts. */
export async function reportedTitles(userId: string, notRejected = false): Promise<TitleRef[]> {
	return db
		.select(titleSelect)
		.from(reports)
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(
			notRejected
				? and(eq(reports.userId, userId), ne(reports.status, 'rejected'))
				: eq(reports.userId, userId)
		);
}

/** Purges the counts of every title the account reported (a mute or a ban takes the account out of them). */
export async function purgeReportedTitles(userId: string): Promise<void> {
	for (const title of await reportedTitles(userId)) purgeTitleReports(title);
}

/**
 * Rejects every report of an account that is not rejected already, on every title, with one
 * log row for the account. Each affected title's counts are purged.
 */
export async function rejectAccountReports(
	actor: UserRow,
	userId: string
): Promise<ReportModerationResult> {
	const [account] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
	if (!account) return { ok: false, reason: 'not-found' };
	const affected = await reportedTitles(userId, true);
	if (affected.length === 0) return { ok: false, reason: 'invalid-state' };

	const where = and(eq(reports.userId, userId), ne(reports.status, 'rejected')) as SQL;
	const results = await runBatch([
		logReportAction(actor.id, 'reject_account_reports', where, false),
		db
			.update(reports)
			.set({ status: 'rejected', holdReason: null, updatedAt: sql`${reports.updatedAt}` })
			.where(where)
			.returning({ titleId: reports.titleId })
	]);
	const moved = results[1];
	if (!Array.isArray(moved) || moved.length === 0) return { ok: false, reason: 'invalid-state' };
	for (const title of affected) purgeTitleReports(title);
	return { ok: true, titles: affected };
}

/** The account facts of each user id: reports that are not rejected, and comments. */
async function accountsOf(
	rows: { userId: string; username: string | null; createdAt: Date }[]
): Promise<Map<string, ReportAccount>> {
	const ids = [...new Set(rows.map((r) => r.userId))];
	const reportCounts = new Map<string, number>();
	const commentCounts = new Map<string, number>();
	for (const chunk of chunkForD1(ids, 1)) {
		for (const r of await db
			.select({ userId: reports.userId, n: sql<number>`count(*)` })
			.from(reports)
			.where(and(inArray(reports.userId, chunk), ne(reports.status, 'rejected')))
			.groupBy(reports.userId))
			reportCounts.set(r.userId, r.n);
		for (const r of await db
			.select({ userId: comments.userId, n: sql<number>`count(*)` })
			.from(comments)
			.where(inArray(comments.userId, chunk))
			.groupBy(comments.userId))
			commentCounts.set(r.userId, r.n);
	}
	return new Map(
		rows.map((r) => [
			r.userId,
			{
				userId: r.userId,
				username: r.username,
				createdAt: r.createdAt.toISOString(),
				reportCount: reportCounts.get(r.userId) ?? 0,
				commentCount: commentCounts.get(r.userId) ?? 0
			}
		])
	);
}

/** Reports waiting for a moderator, oldest first, at most `QUEUE_LIMIT`. */
export async function listHeldReports(): Promise<HeldReport[]> {
	const rows = await db
		.select({
			userId: reports.userId,
			titleId: reports.titleId,
			holdReason: reports.holdReason,
			createdAt: reports.createdAt,
			username: users.username,
			accountCreatedAt: users.createdAt,
			title: titleSelect,
			...answerSelect
		})
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(eq(reports.status, 'held'))
		.orderBy(asc(reports.createdAt))
		.limit(QUEUE_LIMIT);

	const accounts = await accountsOf(
		rows.map((r) => ({ userId: r.userId, username: r.username, createdAt: r.accountCreatedAt }))
	);
	const contradicting = [
		...new Set(rows.filter((r) => r.holdReason === 'contradicts_source').map((r) => r.titleId))
	];
	const um = new Map<string, Record<ConcernFlagKey, boolean>>();
	for (const chunk of chunkForD1(contradicting, 1)) {
		for (const r of await db
			.select({
				titleId: titleUm.titleId,
				...Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, umSource[f.key]]))
			} as { titleId: typeof titleUm.titleId } & {
				[K in ConcernFlagKey]: (typeof umSource)[K];
			})
			.from(titleUm)
			.innerJoin(umSource, eq(titleUm.umId, umSource.umId))
			.where(inArray(titleUm.titleId, chunk))) {
			const { titleId, ...flags } = r;
			um.set(titleId, flags);
		}
	}
	return rows.map((r) => ({
		titleId: r.titleId,
		title: r.title,
		account: accounts.get(r.userId)!,
		holdReason: r.holdReason,
		createdAt: r.createdAt.toISOString(),
		answers: pickAnswers(r),
		um: r.holdReason === 'contradicts_source' ? (um.get(r.titleId) ?? null) : null
	}));
}

const pickAnswers = (row: ReportAnswerColumns): ReportAnswerColumns => ({
	sexualPresent: row.sexualPresent,
	partnerLevel: row.partnerLevel,
	physicalLevel: row.physicalLevel,
	stalkingLevel: row.stalkingLevel,
	objectificationLevel: row.objectificationLevel,
	framing: row.framing,
	...(Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, row[f.key]])) as Record<
		ConcernFlagKey,
		boolean | null
	>)
});

/** Every report on a title, newest first, with its account, for a moderator opening a flagged title. */
export async function listTitleReports(titleId: string): Promise<TitleReport[]> {
	const rows = await db
		.select({
			userId: reports.userId,
			status: reports.status,
			holdReason: reports.holdReason,
			createdAt: reports.createdAt,
			username: users.username,
			accountCreatedAt: users.createdAt,
			...answerSelect
		})
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.where(eq(reports.titleId, titleId))
		.orderBy(desc(reports.createdAt), asc(reports.userId));
	const accounts = await accountsOf(
		rows.map((r) => ({ userId: r.userId, username: r.username, createdAt: r.accountCreatedAt }))
	);
	return rows.map((r) => ({
		account: accounts.get(r.userId)!,
		status: r.status,
		holdReason: r.holdReason,
		createdAt: r.createdAt.toISOString(),
		answers: pickAnswers(r)
	}));
}

/** Titles with open "counts look wrong" flags, most flagged first, at most `QUEUE_LIMIT`. */
export async function listFlaggedTitles(): Promise<FlaggedTitle[]> {
	const open = eq(titleCountFlags.status, 'open');
	const flagged = await db
		.select({
			titleId: titleCountFlags.titleId,
			title: titleSelect
		})
		.from(titleCountFlags)
		.innerJoin(titles, eq(titleCountFlags.titleId, titles.id))
		.where(open)
		.groupBy(titleCountFlags.titleId)
		.orderBy(desc(sql`count(*)`), asc(sql`min(${titleCountFlags.createdAt})`))
		.limit(QUEUE_LIMIT);

	const flags = new Map<string, FlaggedTitle['flags']>();
	for (const chunk of chunkForD1(
		flagged.map((f) => f.titleId),
		1,
		1
	)) {
		for (const f of await db
			.select({
				id: titleCountFlags.id,
				titleId: titleCountFlags.titleId,
				note: titleCountFlags.note,
				createdAt: titleCountFlags.createdAt,
				reporter: users.username
			})
			.from(titleCountFlags)
			.innerJoin(users, eq(titleCountFlags.reporterId, users.id))
			.where(and(inArray(titleCountFlags.titleId, chunk), open))
			.orderBy(asc(titleCountFlags.createdAt))) {
			const list = flags.get(f.titleId) ?? [];
			list.push({
				id: f.id,
				note: f.note,
				reporter: f.reporter,
				createdAt: f.createdAt.toISOString()
			});
			flags.set(f.titleId, list);
		}
	}
	return flagged.map((f) => ({
		titleId: f.titleId,
		title: f.title,
		flags: flags.get(f.titleId) ?? []
	}));
}

/** A title a moderator opened from the flagged list, with every report on it. */
export type OpenTitle = TitleRef & { id: string; reports: TitleReport[] };

/** The title with its reports, or null when no title has that id. */
export async function getOpenTitle(titleId: string): Promise<OpenTitle | null> {
	const [row] = await db
		.select({ id: titles.id, ...titleSelect })
		.from(titles)
		.where(eq(titles.id, titleId));
	if (!row) return null;
	return { ...row, reports: await listTitleReports(titleId) };
}
