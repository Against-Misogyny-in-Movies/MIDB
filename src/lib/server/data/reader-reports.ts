import { and, eq, gt, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { communityContentReports as reports } from '#db/schema/community.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import {
	BURST_WINDOW_HOURS,
	CONCERN_FLAGS,
	REPORT_ACCOUNT_MIN_AGE_DAYS,
	REPORT_CATEGORIES,
	sexualLevelFromFlags,
	type ConcernFlagKey,
	type ObjectificationLevel,
	type ReportCategory,
	type ReportFraming,
	type ReportLevel
} from '#lib/media/utils/readerReports.ts';
import type { contentReportStatus } from '#lib/media/utils/readerReports.ts';
import { holdReasonFor, type HoldReason } from './reader-report-holds.ts';
import {
	getOrCreateTitleRow,
	type TitleKind,
	type TitleRef,
	type TitleRow
} from './title-queries.ts';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

type ContentReportStatus = (typeof contentReportStatus)[number];

/** A reader's answers: a null level, flag or framing is "not sure" or "not answered". */
export type ReportAnswers = {
	/** Left out, it is derived from the flags (`sexualLevelFromFlags`). */
	sexualPresent?: ReportLevel | null;
	partnerLevel: ReportLevel | null;
	physicalLevel: ReportLevel | null;
	stalkingLevel: ReportLevel | null;
	objectificationLevel: ObjectificationLevel | null;
	flags: Partial<Record<ConcernFlagKey, boolean | null>>;
	framing: ReportFraming | null;
};

/** Every flag column, so an edit writes null over a flag the reader no longer answers. */
function flagValues(flags: ReportAnswers['flags']) {
	return Object.fromEntries(CONCERN_FLAGS.map((f) => [f.key, flags[f.key] ?? null])) as Record<
		ConcernFlagKey,
		boolean | null
	>;
}

export type ReportWriteResult = {
	title: TitleRow;
	status: ContentReportStatus;
	holdReason: HoldReason | null;
};

/**
 * Stores a reader's report of a title (one per account per title; a second call overwrites the
 * first) and decides whether it counts: the three hold rules run on every write, an edit
 * included. A `rejected` report stays rejected and holds no reason.
 */
export async function upsertReport(
	userId: string,
	kind: TitleKind,
	ref: TitleRef,
	answers: ReportAnswers
): Promise<ReportWriteResult> {
	const title = await getOrCreateTitleRow(kind, ref);
	const sexualPresent =
		answers.sexualPresent === undefined
			? sexualLevelFromFlags(answers.flags)
			: answers.sexualPresent;
	const now = Date.now();

	const [existing] = await db
		.select({ status: reports.status })
		.from(reports)
		.where(and(eq(reports.userId, userId), eq(reports.titleId, title.id)));

	let status: ContentReportStatus = 'rejected';
	let reason: HoldReason | null = null;
	if (existing?.status !== 'rejected') {
		const [account] = await db
			.select({ createdAt: users.createdAt })
			.from(users)
			.where(eq(users.id, userId));
		const [window] = await db
			.select({ n: sql<number>`count(*)` })
			.from(reports)
			.where(
				and(
					eq(reports.titleId, title.id),
					ne(reports.userId, userId),
					ne(reports.status, 'rejected'),
					gt(reports.createdAt, new Date(now - BURST_WINDOW_HOURS * HOUR_MS))
				)
			);
		const [other] = await db
			.select({ n: sql<number>`count(*)` })
			.from(reports)
			.where(
				and(
					eq(reports.userId, userId),
					ne(reports.titleId, title.id),
					ne(reports.status, 'rejected')
				)
			);
		const [um] = await db
			.select({ ...umFlagSelect })
			.from(titleUm)
			.innerJoin(umSource, eq(titleUm.umId, umSource.umId))
			.where(eq(titleUm.titleId, title.id));

		reason = holdReasonFor({
			sexualPresent,
			flags: answers.flags,
			um: um ?? null,
			othersInWindow: window?.n ?? 0,
			accountAgeDays: account ? (now - account.createdAt.getTime()) / DAY_MS : 0,
			accountOtherReports: other?.n ?? 0
		});
		status = reason ? 'held' : 'counted';
	}

	const values = {
		sexualPresent,
		partnerLevel: answers.partnerLevel,
		physicalLevel: answers.physicalLevel,
		stalkingLevel: answers.stalkingLevel,
		objectificationLevel: answers.objectificationLevel,
		...flagValues(answers.flags),
		framing: answers.framing,
		status,
		holdReason: reason
	};
	await db
		.insert(reports)
		.values({ userId, titleId: title.id, ...values })
		.onConflictDoUpdate({
			target: [reports.userId, reports.titleId],
			set: { ...values, updatedAt: new Date() }
		});
	return { title, status, holdReason: reason };
}

const umFlagSelect = {
	rapeMenDisImp: umSource.rapeMenDisImp,
	sexHarOnScrn: umSource.sexHarOnScrn,
	sexAdultTeen: umSource.sexAdultTeen,
	childSexAbuse: umSource.childSexAbuse,
	incest: umSource.incest,
	attemptedRape: umSource.attemptedRape,
	rapeOffScrn: umSource.rapeOffScrn,
	rapeOnScreen: umSource.rapeOnScreen
};

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
		countsFrom: new Date(row.accountCreatedAt.getTime() + REPORT_ACCOUNT_MIN_AGE_DAYS * DAY_MS)
	};
}

export type LevelCounts = Record<string, number>;

export type ReportCounts = {
	total: number;
	/** Per category, a count for each level and for `unsure` (a null answer). */
	categories: Record<ReportCategory, LevelCounts>;
	/** Per concern flag, `yes`, `no` and `unsure`. */
	flags: Record<ConcernFlagKey, { yes: number; no: number; unsure: number }>;
	/** Per framing; reports that did not answer it appear in none. */
	framing: Record<ReportFraming, number>;
};

const count = (cond: ReturnType<typeof sql>) =>
	sql<number>`coalesce(sum(CASE WHEN ${cond} THEN 1 ELSE 0 END), 0)`;

const LEVELS: Record<ReportCategory, readonly string[]> = {
	sexual: ['none', 'mentioned', 'on_screen'],
	partner: ['none', 'mentioned', 'on_screen'],
	physical: ['none', 'mentioned', 'on_screen'],
	stalking: ['none', 'mentioned', 'on_screen'],
	objectification: ['none', 'some_scenes', 'throughout']
};
const FRAMINGS: readonly ReportFraming[] = [
	'condemned',
	'unclear',
	'played_for_laughs',
	'glamorised_or_justified'
];

/**
 * The counts for a title: only reports that are `counted`, whose account is at least
 * `REPORT_ACCOUNT_MIN_AGE_DAYS` old and is neither banned nor muted. The age is applied here,
 * so a report starts counting on its own, and a cached count can lag by its TTL. Two grouped
 * reads over the same rows: the categories with the framing and the total, then the flags.
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
	const columns = {
		sexual: reports.sexualPresent,
		partner: reports.partnerLevel,
		physical: reports.physicalLevel,
		stalking: reports.stalkingLevel,
		objectification: reports.objectificationLevel
	};

	const selection: Record<string, ReturnType<typeof count>> = {
		total: count(sql`1 = 1`)
	};
	for (const { key } of REPORT_CATEGORIES) {
		for (const level of LEVELS[key])
			selection[`${key}:${level}`] = count(sql`${columns[key]} = ${level}`);
		selection[`${key}:unsure`] = count(sql`${columns[key]} IS NULL`);
	}
	for (const f of FRAMINGS) selection[`framing:${f}`] = count(sql`${reports.framing} = ${f}`);

	const flagSelection: Record<string, ReturnType<typeof count>> = {};
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
			.where(where)
	]);

	const categories = {} as Record<ReportCategory, LevelCounts>;
	for (const { key } of REPORT_CATEGORIES) {
		categories[key] = Object.fromEntries(
			[...LEVELS[key], 'unsure'].map((l) => [l, main[`${key}:${l}`]])
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
	const framing = Object.fromEntries(FRAMINGS.map((f) => [f, main[`framing:${f}`]])) as Record<
		ReportFraming,
		number
	>;
	return { total: main.total, categories, flags, framing };
}
