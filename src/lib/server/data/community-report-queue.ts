import { and, asc, desc, eq, gt, inArray, ne, or, sql } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import {
	comments,
	communityContentReports as reports,
	titleCountFlags
} from '#db/schema/community.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import { titles } from '#db/schema/titles.ts';
import { CONCERN_FLAGS, type ConcernFlagKey } from '#lib/media/utils/communityReports.ts';
import { activeMute } from './mute.ts';
import { accountsMutedByModerator, flagsClosedByAdministrator } from './moderation-target.ts';
import { QUEUE_LIMIT } from './moderation-queue.ts';
import { countsFromDate } from './counting-account.ts';
import { QUEUE_SHAPES, decodeQueueCursor, toQueuePage, type QueuePage } from './queue-cursor.ts';

type ReportRow = typeof reports.$inferSelect;

/** A title a report is on, with what the edge cache tag and a link need. */
export type ReportedTitle = {
	kind: (typeof titles.$inferSelect)['kind'];
	tmdbId: number | null;
	name: string;
};

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
	role: (typeof users.$inferSelect)['role'];
	/** When the account's reports start to count (ISO): its creation plus the minimum age. */
	countsFrom: string;
	/** Why the account's reports are left out of the counts now: it is banned or muted. */
	restricted: 'banned' | 'muted' | null;
	/** Whether a moderator set the account's latest mute, which a moderator may end (`muteSetByModerator`). */
	mutedByModerator: boolean;
};

export type HeldReport = {
	titleId: string;
	title: ReportedTitle;
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
	/** UM's concern flags for the title, only when the hold reason is `contradicts_source` and the title has a UM binding. */
	um: Record<ConcernFlagKey, boolean> | null;
};

export type FlaggedTitle = {
	titleId: string;
	title: ReportedTitle;
	flags: {
		id: string;
		/** `open` on the flagged list; a closed flag only on an open title's closed list. */
		status: (typeof titleCountFlags.$inferSelect)['status'];
		note: string | null;
		reporter: string | null;
		/** The reporter's account and role, so the page hides the buttons a moderator may not use (their own flag, an administrator's). */
		reporterId: string;
		reporterRole: string;
		/** Whether an administrator took the flag's latest close, which a moderator cannot re-open (`canReopenFlag`); false on an open flag. */
		closedByAdministrator: boolean;
		createdAt: string;
	}[];
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

export const titleSelect = { kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title };

const accountSelect = {
	userId: reports.userId,
	username: users.username,
	role: users.role,
	accountCreatedAt: users.createdAt,
	bannedAt: users.bannedAt,
	mutedUntil: users.mutedUntil
};

type AccountRow = {
	userId: string;
	username: string | null;
	role: (typeof users.$inferSelect)['role'];
	accountCreatedAt: Date;
	bannedAt: Date | null;
	mutedUntil: Date | null;
};

/** The account facts of each reporter: reports that are not rejected, comments, and the counting state. */
async function accountsOf(rows: AccountRow[]): Promise<Map<string, ReportAccount>> {
	const ids = [...new Set(rows.map((r) => r.userId))];
	const reportCounts = new Map<string, number>();
	const commentCounts = new Map<string, number>();
	for (const chunk of chunkForD1(ids, 1, 1)) {
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
	const mutedByModerator = await accountsMutedByModerator(
		ids.filter((id) => activeMute(rows.find((r) => r.userId === id)?.mutedUntil ?? null))
	);
	return new Map(
		rows.map((r) => [
			r.userId,
			{
				userId: r.userId,
				username: r.username,
				createdAt: r.accountCreatedAt.toISOString(),
				reportCount: reportCounts.get(r.userId) ?? 0,
				commentCount: commentCounts.get(r.userId) ?? 0,
				role: r.role,
				countsFrom: countsFromDate(r.accountCreatedAt, r.role).toISOString(),
				restricted: r.bannedAt ? 'banned' : activeMute(r.mutedUntil) ? 'muted' : null,
				mutedByModerator: mutedByModerator.has(r.userId)
			}
		])
	);
}

/** UM's concern flags for the titles that have a UM binding, by title id. */
async function umFlagsOf(
	titleIds: string[]
): Promise<Map<string, Record<ConcernFlagKey, boolean>>> {
	const um = new Map<string, Record<ConcernFlagKey, boolean>>();
	for (const chunk of chunkForD1([...new Set(titleIds)], 1)) {
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
	return um;
}

/**
 * A page of the reports waiting for a moderator, oldest first (then account and title, the
 * report's key, so the order is total). A cursor this module did not make reads as the first page.
 */
export async function listHeldReports(
	cursor?: string | null,
	limit = QUEUE_LIMIT
): Promise<QueuePage<HeldReport>> {
	const after = decodeQueueCursor(cursor, QUEUE_SHAPES.held);
	const found = await db
		.select({
			titleId: reports.titleId,
			holdReason: reports.holdReason,
			createdAt: reports.createdAt,
			...accountSelect,
			title: titleSelect,
			...answerSelect
		})
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(
			and(
				eq(reports.status, 'held'),
				after
					? or(
							gt(reports.createdAt, new Date(after[0])),
							and(
								eq(reports.createdAt, new Date(after[0])),
								or(
									gt(reports.userId, after[1]),
									and(eq(reports.userId, after[1]), gt(reports.titleId, after[2]))
								)
							)
						)
					: undefined
			)
		)
		.orderBy(asc(reports.createdAt), asc(reports.userId), asc(reports.titleId))
		.limit(limit + 1);
	const page = toQueuePage(found, limit, (r) => [r.createdAt.getTime(), r.userId, r.titleId]);
	const rows = page.items;

	const accounts = await accountsOf(rows);
	const um = await umFlagsOf(
		rows.filter((r) => r.holdReason === 'contradicts_source').map((r) => r.titleId)
	);
	return {
		nextCursor: page.nextCursor,
		items: rows.map((r) => ({
			titleId: r.titleId,
			title: r.title,
			account: accounts.get(r.userId)!,
			holdReason: r.holdReason,
			createdAt: r.createdAt.toISOString(),
			answers: pickAnswers(r),
			um: r.holdReason === 'contradicts_source' ? (um.get(r.titleId) ?? null) : null
		}))
	};
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
			status: reports.status,
			holdReason: reports.holdReason,
			createdAt: reports.createdAt,
			...accountSelect,
			...answerSelect
		})
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.where(eq(reports.titleId, titleId))
		.orderBy(desc(reports.createdAt), asc(reports.userId));
	const accounts = await accountsOf(rows);
	const um = rows.some((r) => r.holdReason === 'contradicts_source')
		? ((await umFlagsOf([titleId])).get(titleId) ?? null)
		: null;
	return rows.map((r) => ({
		account: accounts.get(r.userId)!,
		status: r.status,
		holdReason: r.holdReason,
		createdAt: r.createdAt.toISOString(),
		answers: pickAnswers(r),
		um: r.holdReason === 'contradicts_source' ? um : null
	}));
}

type TitleFlags = FlaggedTitle['flags'];

/** The open flags on the titles in `titleIds`, oldest first, by title id. */
async function openFlagsOf(titleIds: string[]): Promise<Map<string, TitleFlags>> {
	const flags = new Map<string, TitleFlags>();
	for (const chunk of chunkForD1(titleIds, 1, 1)) {
		for (const f of await db
			.select({
				id: titleCountFlags.id,
				status: titleCountFlags.status,
				titleId: titleCountFlags.titleId,
				note: titleCountFlags.note,
				createdAt: titleCountFlags.createdAt,
				reporter: users.username,
				reporterId: users.id,
				reporterRole: users.role
			})
			.from(titleCountFlags)
			.innerJoin(users, eq(titleCountFlags.reporterId, users.id))
			.where(and(inArray(titleCountFlags.titleId, chunk), eq(titleCountFlags.status, 'open')))
			.orderBy(asc(titleCountFlags.createdAt))) {
			const list = flags.get(f.titleId) ?? [];
			list.push({
				id: f.id,
				status: f.status,
				note: f.note,
				reporter: f.reporter,
				reporterId: f.reporterId,
				reporterRole: f.reporterRole,
				closedByAdministrator: false,
				createdAt: f.createdAt.toISOString()
			});
			flags.set(f.titleId, list);
		}
	}
	return flags;
}

/** The most recently closed flags on a title kept for the open title view, which offers to re-open them. */
const CLOSED_FLAGS_SHOWN = 20;

/** The title's resolved and dismissed flags, the most recently closed first. */
async function closedFlagsOf(titleId: string): Promise<TitleFlags> {
	const found = await db
		.select({
			id: titleCountFlags.id,
			status: titleCountFlags.status,
			note: titleCountFlags.note,
			createdAt: titleCountFlags.createdAt,
			reporter: users.username,
			reporterId: users.id,
			reporterRole: users.role
		})
		.from(titleCountFlags)
		.innerJoin(users, eq(titleCountFlags.reporterId, users.id))
		.where(and(eq(titleCountFlags.titleId, titleId), ne(titleCountFlags.status, 'open')))
		.orderBy(desc(titleCountFlags.updatedAt), desc(titleCountFlags.id))
		.limit(CLOSED_FLAGS_SHOWN);
	const adminClosed = await flagsClosedByAdministrator(
		found.map((f) => ({ reporterId: f.reporterId, titleId }))
	);
	return found.map((f) => ({
		id: f.id,
		status: f.status,
		note: f.note,
		reporter: f.reporter,
		reporterId: f.reporterId,
		reporterRole: f.reporterRole,
		closedByAdministrator: adminClosed.has(`${f.reporterId}:${titleId}`),
		createdAt: f.createdAt.toISOString()
	}));
}

/**
 * A page of the titles with open "counts look wrong" flags: most flagged first, then the oldest
 * flag, then title id. A cursor this module did not make reads as the first page.
 */
export async function listFlaggedTitles(
	cursor?: string | null,
	limit = QUEUE_LIMIT
): Promise<QueuePage<FlaggedTitle>> {
	const after = decodeQueueCursor(cursor, QUEUE_SHAPES.flagged);
	const flagCount = sql<number>`count(*)`;
	const oldest = sql<number>`min(${titleCountFlags.createdAt})`;
	const found = await db
		.select({
			titleId: titleCountFlags.titleId,
			title: titleSelect,
			flagCount,
			oldest
		})
		.from(titleCountFlags)
		.innerJoin(titles, eq(titleCountFlags.titleId, titles.id))
		.where(eq(titleCountFlags.status, 'open'))
		.groupBy(titleCountFlags.titleId)
		.having(
			after
				? or(
						sql`${flagCount} < ${after[0]}`,
						and(
							sql`${flagCount} = ${after[0]}`,
							or(
								sql`${oldest} > ${after[1]}`,
								and(sql`${oldest} = ${after[1]}`, gt(titleCountFlags.titleId, after[2]))
							)
						)
					)
				: undefined
		)
		.orderBy(desc(flagCount), asc(oldest), asc(titleCountFlags.titleId))
		.limit(limit + 1);
	const page = toQueuePage(found, limit, (f) => [f.flagCount, f.oldest, f.titleId]);
	const flags = await openFlagsOf(page.items.map((f) => f.titleId));
	return {
		nextCursor: page.nextCursor,
		items: page.items.map((f) => ({
			titleId: f.titleId,
			title: f.title,
			flags: flags.get(f.titleId) ?? []
		}))
	};
}

/** A title a moderator opened from the flagged list, with every report on it. */
export type OpenTitle = ReportedTitle & {
	id: string;
	reports: TitleReport[];
	/** The title's open "counts look wrong" flags, whichever page of the flagged list it is on. */
	flags: TitleFlags;
	/** Its recently closed flags, which a moderator may re-open. */
	closedFlags: TitleFlags;
};

/** The title with its reports, or null when no title has that id. */
export async function getOpenTitle(titleId: string): Promise<OpenTitle | null> {
	const [row] = await db
		.select({ id: titles.id, ...titleSelect })
		.from(titles)
		.where(eq(titles.id, titleId));
	if (!row) return null;
	const [reportList, flags, closedFlags] = await Promise.all([
		listTitleReports(titleId),
		openFlagsOf([titleId]),
		closedFlagsOf(titleId)
	]);
	return { ...row, reports: reportList, flags: flags.get(titleId) ?? [], closedFlags };
}
