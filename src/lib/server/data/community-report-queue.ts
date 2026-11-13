import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
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
import { QUEUE_LIMIT } from './moderation-queue.ts';
import { countsFromDate } from './community-reports.ts';

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
				countsFrom: countsFromDate(r.accountCreatedAt).toISOString(),
				restricted: r.bannedAt ? 'banned' : activeMute(r.mutedUntil) ? 'muted' : null
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

/** Reports waiting for a moderator, oldest first, at most `QUEUE_LIMIT`. */
export async function listHeldReports(): Promise<HeldReport[]> {
	const rows = await db
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
		.where(eq(reports.status, 'held'))
		.orderBy(asc(reports.createdAt))
		.limit(QUEUE_LIMIT);

	const accounts = await accountsOf(rows);
	const um = await umFlagsOf(
		rows.filter((r) => r.holdReason === 'contradicts_source').map((r) => r.titleId)
	);
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
export type OpenTitle = ReportedTitle & { id: string; reports: TitleReport[] };

/** The title with its reports, or null when no title has that id. */
export async function getOpenTitle(titleId: string): Promise<OpenTitle | null> {
	const [row] = await db
		.select({ id: titles.id, ...titleSelect })
		.from(titles)
		.where(eq(titles.id, titleId));
	if (!row) return null;
	return { ...row, reports: await listTitleReports(titleId) };
}
