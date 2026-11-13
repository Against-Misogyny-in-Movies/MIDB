import { and, eq, gt, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { communityContentReports as reports } from '#db/schema/community.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import {
	BURST_WINDOW_HOURS,
	CONCERN_FLAGS,
	REPORT_ACCOUNT_MIN_AGE_DAYS,
	REPORT_CATEGORIES,
	objectificationLevel,
	reportFraming,
	reportLevel,
	sexualLevel,
	type ConcernFlagKey,
	type ContentReportStatus,
	type ObjectificationLevel,
	type ReportCategory,
	type ReportFraming,
	type ReportLevel,
	type SexualLevel
} from '#lib/media/utils/readerReports.ts';
import { holdReasonFor, type HoldFacts, type HoldReason } from './reader-report-holds.ts';
import {
	getOrCreateTitleRow,
	type TitleKind,
	type TitleRef,
	type TitleRow
} from './title-queries.ts';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** A reader's answers: a null level, flag or framing is "not sure" or "not answered". */
export type ReportAnswers = {
	/** Whether sexual violence is shown; the flags are kept only when it is `present`. */
	sexualPresent: SexualLevel | null;
	partnerLevel: ReportLevel | null;
	physicalLevel: ReportLevel | null;
	stalkingLevel: ReportLevel | null;
	objectificationLevel: ObjectificationLevel | null;
	flags: Partial<Record<ConcernFlagKey, boolean | null>>;
	framing: ReportFraming | null;
};

/** A report's answers contradict each other; the write route answers 400. */
export class ReportAnswersError extends Error {}

/**
 * Every flag column: the reader's answer when sexual violence is `present`, else null, so an
 * edit writes null over a flag the reader no longer answers. A Yes flag under "Not shown" is
 * refused.
 */
function flagValues({ sexualPresent, flags }: ReportAnswers) {
	if (sexualPresent === 'none' && CONCERN_FLAGS.some((f) => flags[f.key] === true))
		throw new ReportAnswersError('A concern flag is Yes while sexual violence is Not shown.');
	return Object.fromEntries(
		CONCERN_FLAGS.map((f) => [f.key, sexualPresent === 'present' ? (flags[f.key] ?? null) : null])
	) as Record<ConcernFlagKey, boolean | null>;
}

export type ReportWriteResult = {
	title: TitleRow;
	status: ContentReportStatus;
	holdReason: HoldReason | null;
};

/** When a report from an account created at `createdAt` starts counting. */
export function countsFromDate(createdAt: Date): Date {
	return new Date(createdAt.getTime() + REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS);
}

/** The title's Unconsenting Media concern flags, selected by `CONCERN_FLAGS`. */
const umFlagSelect = Object.fromEntries(
	CONCERN_FLAGS.map((f) => [f.key, umSource[f.key]])
) as Record<ConcernFlagKey, (typeof umSource)[ConcernFlagKey]>;

/** Loads what the hold rules read for a report that is about to be written. */
async function loadHoldFacts(
	userId: string,
	titleId: string,
	answers: ReportAnswers,
	flags: Record<ConcernFlagKey, boolean | null>,
	now: number
): Promise<HoldFacts> {
	const [[account], [existing], [window], [other], [um]] = await Promise.all([
		db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)),
		db
			.select({ createdAt: reports.createdAt })
			.from(reports)
			.where(and(eq(reports.userId, userId), eq(reports.titleId, titleId))),
		db
			.select({ n: sql<number>`count(*)` })
			.from(reports)
			.where(
				and(
					eq(reports.titleId, titleId),
					ne(reports.userId, userId),
					ne(reports.status, 'rejected'),
					gt(reports.createdAt, new Date(now - BURST_WINDOW_HOURS * HOUR_MS))
				)
			),
		db
			.select({ n: sql<number>`count(*)` })
			.from(reports)
			.where(
				and(
					eq(reports.userId, userId),
					ne(reports.titleId, titleId),
					ne(reports.status, 'rejected')
				)
			),
		db
			.select({ ...umFlagSelect })
			.from(titleUm)
			.innerJoin(umSource, eq(titleUm.umId, umSource.umId))
			.where(eq(titleUm.titleId, titleId))
	]);
	return {
		sexualPresent: answers.sexualPresent,
		flags,
		um: um ?? null,
		othersInWindow: window?.n ?? 0,
		createdInWindow: !existing || existing.createdAt.getTime() > now - BURST_WINDOW_HOURS * HOUR_MS,
		accountAgeDays: account ? (now - account.createdAt.getTime()) / DAY_MS : 0,
		accountOtherReports: other?.n ?? 0
	};
}

/**
 * Stores a reader's report of a title (one per account per title; a second call overwrites the
 * first) and decides whether it counts: the three hold rules run on every write, an edit
 * included. A `rejected` report stays rejected and holds no reason; the write statement itself
 * keeps it so, so a moderator's rejection cannot be undone by a concurrent edit.
 */
export async function upsertReport(
	userId: string,
	kind: TitleKind,
	ref: TitleRef,
	answers: ReportAnswers
): Promise<ReportWriteResult> {
	const flags = flagValues(answers);
	const title = await getOrCreateTitleRow(kind, ref);

	const reason = holdReasonFor(await loadHoldFacts(userId, title.id, answers, flags, Date.now()));
	const status: ContentReportStatus = reason ? 'held' : 'counted';

	const values = {
		sexualPresent: answers.sexualPresent,
		partnerLevel: answers.partnerLevel,
		physicalLevel: answers.physicalLevel,
		stalkingLevel: answers.stalkingLevel,
		objectificationLevel: answers.objectificationLevel,
		...flags,
		framing: answers.framing
	};
	const [row] = await db
		.insert(reports)
		.values({ userId, titleId: title.id, ...values, status, holdReason: reason })
		.onConflictDoUpdate({
			target: [reports.userId, reports.titleId],
			set: {
				...values,
				status: sql`CASE WHEN ${reports.status} = 'rejected' THEN 'rejected' ELSE ${status} END`,
				holdReason: sql`CASE WHEN ${reports.status} = 'rejected' THEN NULL ELSE ${reason} END`,
				updatedAt: new Date()
			}
		})
		.returning({ status: reports.status, holdReason: reports.holdReason });
	return { title, status: row.status, holdReason: row.holdReason };
}

/** Deletes the reader's report of a title; true when there was one. */
export async function deleteReport(userId: string, titleId: string): Promise<boolean> {
	const rows = await db
		.delete(reports)
		.where(and(eq(reports.userId, userId), eq(reports.titleId, titleId)))
		.returning({ titleId: reports.titleId });
	return rows.length > 0;
}

export type ViewerReport = Omit<typeof reports.$inferSelect, 'userId' | 'titleId'> & {
	/** When the report starts counting: the account's age reaches `REPORT_ACCOUNT_MIN_AGE_DAYS`. */
	countsFrom: Date;
};

/** The reader's own report of a title with its status, or null. */
export async function getViewerReport(
	userId: string,
	titleId: string
): Promise<ViewerReport | null> {
	const [row] = await db
		.select({ report: reports, accountCreatedAt: users.createdAt })
		.from(reports)
		.innerJoin(users, eq(reports.userId, users.id))
		.where(and(eq(reports.userId, userId), eq(reports.titleId, titleId)));
	if (!row) return null;
	const { userId: _u, titleId: _t, ...rest } = row.report;
	return {
		...rest,
		countsFrom: countsFromDate(row.accountCreatedAt)
	};
}

/** A count per level of a category's level set, and `unsure` for a null answer. */
export type LevelCounts = Partial<
	Record<ReportLevel | SexualLevel | ObjectificationLevel | 'unsure', number>
>;

export type ReportCounts = {
	total: number;
	/** Per category, a count for each level and for `unsure` (a null answer). */
	categories: Record<ReportCategory, LevelCounts>;
	/** Per concern flag, `yes`, `no` and `unsure`, over the reports that said sexual violence is present. */
	flags: Record<ConcernFlagKey, { yes: number; no: number; unsure: number }>;
	/** Per framing; reports that did not answer it appear in none. */
	framing: Record<ReportFraming, number>;
};

/** The level values of a category's level set. */
const levelsOf = (set: 'violence' | 'sexual' | 'objectification') =>
	set === 'violence' ? reportLevel : set === 'sexual' ? sexualLevel : objectificationLevel;

const count = (cond: SQL) => sql<number>`coalesce(sum(CASE WHEN ${cond} THEN 1 ELSE 0 END), 0)`;

/**
 * The counts for a title: only reports that are `counted`, whose account is at least
 * `REPORT_ACCOUNT_MIN_AGE_DAYS` old and is neither banned nor muted. The age is applied here,
 * so a report starts counting on its own, and a cached count can lag by its TTL. Two grouped
 * reads: the categories with the framing and the total, then the flags, which only the reports
 * that said sexual violence is present were asked.
 */
export async function getReportCounts(titleId: string): Promise<ReportCounts> {
	const now = Date.now();
	const where = and(
		eq(reports.titleId, titleId),
		eq(reports.status, 'counted'),
		sql`${users.createdAt} <= ${now - REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS}`,
		sql`${users.bannedAt} IS NULL`,
		sql`(${users.mutedUntil} IS NULL OR ${users.mutedUntil} <= ${now})`
	);

	const selection: Record<string, SQL<number>> = {
		total: count(sql`1 = 1`)
	};
	for (const category of REPORT_CATEGORIES) {
		const column = reports[category.field];
		for (const level of levelsOf(category.levels))
			selection[`${category.key}:${level}`] = count(sql`${column} = ${level}`);
		selection[`${category.key}:unsure`] = count(sql`${column} IS NULL`);
	}
	for (const f of reportFraming) selection[`framing:${f}`] = count(sql`${reports.framing} = ${f}`);

	const flagSelection: Record<string, SQL<number>> = {};
	for (const { key } of CONCERN_FLAGS) {
		flagSelection[`${key}:yes`] = count(sql`${reports[key]} = 1`);
		flagSelection[`${key}:no`] = count(sql`${reports[key]} = 0`);
		flagSelection[`${key}:unsure`] = count(sql`${reports[key]} IS NULL`);
	}

	const [[main], [flagRow]] = await Promise.all([
		db.select(selection).from(reports).innerJoin(users, eq(reports.userId, users.id)).where(where),
		db
			.select(flagSelection)
			.from(reports)
			.innerJoin(users, eq(reports.userId, users.id))
			.where(and(where, eq(reports.sexualPresent, 'present')))
	]);

	const categories = {} as Record<ReportCategory, LevelCounts>;
	for (const { key, levels } of REPORT_CATEGORIES) {
		categories[key] = Object.fromEntries(
			[...levelsOf(levels), 'unsure'].map((l) => [l, main[`${key}:${l}`]])
		);
	}
	const flags = {} as ReportCounts['flags'];
	for (const { key } of CONCERN_FLAGS) {
		flags[key] = {
			yes: flagRow[`${key}:yes`],
			no: flagRow[`${key}:no`],
			unsure: flagRow[`${key}:unsure`]
		};
	}
	const framing = Object.fromEntries(reportFraming.map((f) => [f, main[`framing:${f}`]])) as Record<
		ReportFraming,
		number
	>;
	return { total: main.total, categories, flags, framing };
}
