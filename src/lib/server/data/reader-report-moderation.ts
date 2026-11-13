import { and, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { communityContentReports as reports, moderationActions } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { purgeTitleReports, purgeTitlesReports } from '#lib/server/http/purge-title.ts';
import type { moderationAction } from '#lib/media/utils/comments.ts';
import { runBatch, type BatchStatement } from './comment-status.ts';
import { targetAllowed } from './moderation-target.ts';
import { titleSelect, type ReportedTitle } from './reader-report-queue.ts';
import type { UserRow } from './user-queries.ts';

type Action = (typeof moderationAction)[number];
type ReportRow = typeof reports.$inferSelect;

export type ReportModerationResult =
	| { ok: true; titles: ReportedTitle[] }
	| { ok: false; reason: 'not-found' | 'invalid-state' | 'forbidden-target' };

/**
 * The log row for an action on reader reports, written only while a report matching `where`
 * exists, so a lost race leaves neither a status change nor a log line. It is one row, naming
 * the report's account and the title `title` selects (the report's own, or NULL for an action
 * that covers several titles).
 */
function logReportAction(
	actorId: string,
	action: Action,
	where: SQL,
	title: typeof reports.titleId | SQL.Aliased<string | null>
): BatchStatement {
	return db.insert(moderationActions).select(
		db
			.select({
				id: sql<string>`${crypto.randomUUID()}`.as('id'),
				actorId: sql<string>`${actorId}`.as('actorId'),
				targetCommentId: sql<string | null>`NULL`.as('targetCommentId'),
				targetUserId: reports.userId,
				targetTitleId: title,
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

/**
 * Moves one report between statuses, logging it, in one batch; the purge follows. The actor
 * must be allowed to act on the report's account (`targetAllowed`).
 */
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
	const account = await targetAllowed(actor, userId);
	if (typeof account === 'string') return { ok: false, reason: account };
	if (!spec.from.includes(found.status)) return { ok: false, reason: 'invalid-state' };

	const where = and(
		eq(reports.userId, userId),
		eq(reports.titleId, titleId),
		inArray(reports.status, spec.from)
	);
	const results = await runBatch([
		logReportAction(actor.id, action, where as SQL, reports.titleId),
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

/** The titles with the ids given. */
async function titlesById(ids: string[]): Promise<ReportedTitle[]> {
	const found: ReportedTitle[] = [];
	for (const chunk of chunkForD1(ids, 1)) {
		found.push(...(await db.select(titleSelect).from(titles).where(inArray(titles.id, chunk))));
	}
	return found;
}

/** Purges the counts of every title the account reported (a mute or a ban takes the account out of them). */
export async function purgeReportedTitles(userId: string): Promise<void> {
	const reported = await db
		.select(titleSelect)
		.from(reports)
		.innerJoin(titles, eq(reports.titleId, titles.id))
		.where(eq(reports.userId, userId));
	purgeTitlesReports(reported);
}

/**
 * Rejects every report of an account that is not rejected already, on every title, with one
 * log row for the account. The counts of the titles the update changed are purged. The actor
 * must be allowed to act on the account (`targetAllowed`).
 */
export async function rejectAccountReports(
	actor: UserRow,
	userId: string
): Promise<ReportModerationResult> {
	const account = await targetAllowed(actor, userId);
	if (typeof account === 'string') return { ok: false, reason: account };

	const where = and(eq(reports.userId, userId), ne(reports.status, 'rejected')) as SQL;
	const results = await runBatch([
		logReportAction(
			actor.id,
			'reject_account_reports',
			where,
			sql<string | null>`NULL`.as('targetTitleId')
		),
		db
			.update(reports)
			.set({ status: 'rejected', holdReason: null, updatedAt: sql`${reports.updatedAt}` })
			.where(where)
			.returning({ titleId: reports.titleId })
	]);
	const moved = results[1];
	if (!Array.isArray(moved) || moved.length === 0) return { ok: false, reason: 'invalid-state' };
	const affected = await titlesById(moved.map((r: { titleId: string }) => r.titleId));
	purgeTitlesReports(affected);
	return { ok: true, titles: affected };
}
