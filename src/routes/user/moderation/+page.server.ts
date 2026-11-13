import type { Actions, PageServerLoad } from './$types';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { requireRole } from '#lib/server/auth/guards.ts';
import { purgeTitleComments } from '#lib/server/http/purge-title.ts';
import { act, text, type Outcome } from '#lib/server/http/moderation-action.ts';
import { env } from '#lib/server/env.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment,
	type ModerationResult
} from '#lib/server/data/moderation-actions.ts';
import {
	listPendingQueue,
	listRecentActions,
	listReportedQueue
} from '#lib/server/data/moderation-queue.ts';
import {
	approveReport,
	rejectAccountReports,
	rejectReport,
	type ReportModerationResult
} from '#lib/server/data/community-report-moderation.ts';
import {
	getOpenTitle,
	listFlaggedTitles,
	listHeldReports
} from '#lib/server/data/community-report-queue.ts';
import { listModerationTable } from '#lib/server/data/moderation-table.ts';
import { saveScanLabels } from '#lib/server/data/comment-ai-labels.ts';
import { getCommentWithTitle } from '#lib/server/data/comment-queries.ts';
import { queryToFilters } from '#lib/server/moderation/search-filters.ts';
import { scanComments, type ScanItem } from '#lib/server/moderation/scan.ts';
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import { AI_QUERY_MAX, MODERATION_REASON_MAX, MUTE_HOURS } from '#lib/media/utils/comments.ts';
import {
	TABLE_PAGE_SIZE,
	filtersToParams,
	parseFilters
} from '#lib/media/utils/moderationFilters.ts';
import { staleSyncSources } from '#lib/media/utils/staleSync.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

/**
 * The page and both of its views. `?tab=reports` opens the community-reports tab, and
 * `?title=<id>` opens one title's community reports in it; without a title the tab lists the held
 * reports and the flagged titles. `?tab=table` also loads the table of every comment, whose
 * filters live in the same query (its `title` filter is a name, so it opens no title's reports).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	await requireRole(locals, STAFF_ROLES, { page: true });
	const isTable = url.searchParams.get('tab') === 'table';
	const titleId = isTable ? null : url.searchParams.get('title')?.trim() || null;
	const filters = isTable ? parseFilters(url.searchParams) : null;
	const [pending, reported, recent, held, flagged, openTitle, syncDates, table] = await Promise.all(
		[
			listPendingQueue(),
			listReportedQueue(),
			listRecentActions(),
			listHeldReports(),
			listFlaggedTitles(),
			titleId ? getOpenTitle(titleId) : null,
			getSourceSyncDates(),
			filters ? listModerationTable(filters) : null
		]
	);
	return {
		tab: url.searchParams.get('tab'),
		titleId,
		pending,
		reported,
		recent,
		held,
		flagged,
		openTitle,
		staleSources: staleSyncSources(syncDates),
		table,
		filters,
		// Whether the AI controls work; never the key itself.
		aiAvailable: isTable && !!env.ANTHROPIC_API_KEY
	};
};

/** A comment action answers for the comment row, or for the account row when it names only an account. */
const commentKey = (data: FormData) => text(data, 'id') ?? text(data, 'userId');
const accountKey = (data: FormData) => text(data, 'userId');
const flagKey = (data: FormData) => text(data, 'id');
const reportKey = (data: FormData) => {
	const userId = text(data, 'userId');
	const titleId = text(data, 'titleId');
	return userId && titleId ? `${userId}:${titleId}` : null;
};

/** A comment action's title list is purged once it succeeds; a user action has no title. */
const purgeComments = (result: Extract<Outcome, { ok: true }>) => {
	if ('title' in result && result.title) purgeTitleComments(result.title);
};

/** A closed flag changes no counts, so it names no title; a flag that was not open is refused. */
const flagResult = (closed: boolean): ReportModerationResult =>
	closed ? { ok: true, titles: [] } : { ok: false, reason: 'invalid-state' };

/** A reason for a hide or a reject, cut to the limit the author's page shows. */
const reasonOf = (data: FormData) => text(data, 'reason')?.slice(0, MODERATION_REASON_MAX) ?? null;

/** The five operations a bulk action applies to each comment, by the single-comment functions. */
const BULK_OPS = {
	approve: (staff, id) => approveComment(staff, id),
	hide: (staff, id, reason) => hideComment(staff, id, reason),
	reject: (staff, id, reason) => rejectComment(staff, id, reason),
	restore: (staff, id) => restoreComment(staff, id),
	dismiss: (staff, id) => dismissReports(staff, id)
} satisfies Record<
	string,
	(staff: UserRow, id: string, reason: string | null) => Promise<ModerationResult>
>;

const isBulkOp = (op: string | null): op is keyof typeof BULK_OPS =>
	op !== null && Object.hasOwn(BULK_OPS, op);

/** The distinct comment ids of the form's `ids` fields; null when none, or more than a page. */
function pageIds(data: FormData): string[] | null {
	const ids = [
		...new Set(
			data
				.getAll('ids')
				.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
				.map((id) => id.trim())
		)
	];
	return ids.length > 0 && ids.length <= TABLE_PAGE_SIZE ? ids : null;
}

/**
 * Applies one operation to each comment in turn. Each function checks the comment's state and
 * the author's standing itself, so a refusal costs only its own comment. Every title touched is
 * purged once, however many of its comments changed.
 */
function bulk(event: Parameters<Actions[string]>[0]) {
	const touched = new Map<string, NonNullable<Extract<ModerationResult, { ok: true }>['title']>>();
	return act(
		event,
		'bulk',
		() => 'bulk',
		async (staff, data): Promise<Outcome> => {
			const op = text(data, 'op');
			const ids = pageIds(data);
			if (!isBulkOp(op) || !ids) return { ok: false, reason: 'invalid' };
			const reason = reasonOf(data);
			let applied = 0;
			let refused: Extract<ModerationResult, { ok: false }>['reason'] | null = null;
			for (const id of ids) {
				const result = await BULK_OPS[op](staff, id, reason);
				if (!result.ok) {
					refused ??= result.reason;
					continue;
				}
				applied += 1;
				const title = result.title;
				if (title) touched.set(title.id, title);
			}
			if (applied === 0 && refused) return { ok: false, reason: refused };
			return { ok: true, extra: { op, applied, refused: ids.length - applied } };
		},
		() => {
			for (const title of touched.values()) purgeTitleComments(title);
		}
	);
}

/** The comments a scan sends: found ones that are not deleted, with their title's name and kind. */
async function scanItems(ids: string[]): Promise<ScanItem[]> {
	const found = await Promise.all(ids.map((id) => getCommentWithTitle(id)));
	return found.flatMap((entry) =>
		entry && entry.comment.status !== 'deleted'
			? [
					{
						id: entry.comment.id,
						body: entry.comment.body,
						titleName: entry.title.name,
						kind: entry.title.kind
					}
				]
			: []
	);
}

export const actions: Actions = {
	aiSearch: (event) =>
		act(
			event,
			'aiSearch',
			() => 'aiSearch',
			async (_staff, data): Promise<Outcome> => {
				const query = text(data, 'query');
				if (!query || query.length > AI_QUERY_MAX) return { ok: false, reason: 'invalid' };
				const result = await queryToFilters(query, new Date().toISOString().slice(0, 10));
				if (!result.ok) return { ok: false, reason: result.code };
				return { ok: true, extra: { params: filtersToParams(result.filters).toString() } };
			},
			undefined,
			'RL_MODERATE_AI'
		),
	scan: (event) =>
		act(
			event,
			'scan',
			() => 'scan',
			async (staff, data): Promise<Outcome> => {
				const concern = text(data, 'concern');
				const ids = pageIds(data);
				if (!concern || !ids) return { ok: false, reason: 'invalid' };
				const items = await scanItems(ids);
				const scan = await scanComments(concern, items);
				if (!scan.ok) return { ok: false, reason: scan.code };
				await saveScanLabels(staff.id, concern, scan.results);
				const matched = scan.results.filter((result) => result.match).length;
				return {
					ok: true,
					extra: {
						matched,
						checked: scan.results.length,
						notChecked: ids.length - scan.results.length
					}
				};
			},
			undefined,
			'RL_MODERATE_AI'
		),
	bulk,
	approve: (event) =>
		act(
			event,
			'approve',
			commentKey,
			(staff, data) => approveComment(staff, text(data, 'id') ?? ''),
			purgeComments
		),
	hide: (event) =>
		act(
			event,
			'hide',
			commentKey,
			(staff, data) => hideComment(staff, text(data, 'id') ?? '', reasonOf(data)),
			purgeComments
		),
	reject: (event) =>
		act(
			event,
			'reject',
			commentKey,
			(staff, data) => rejectComment(staff, text(data, 'id') ?? '', reasonOf(data)),
			purgeComments
		),
	restore: (event) =>
		act(
			event,
			'restore',
			commentKey,
			(staff, data) => restoreComment(staff, text(data, 'id') ?? ''),
			purgeComments
		),
	dismiss: (event) =>
		act(
			event,
			'dismiss',
			commentKey,
			(staff, data) => dismissReports(staff, text(data, 'id') ?? ''),
			purgeComments
		),
	mute: (event) =>
		act(
			event,
			'mute',
			commentKey,
			(staff, data) => {
				const hours = Number(text(data, 'hours'));
				if (!MUTE_HOURS.some((h) => h === hours)) return { ok: false, reason: 'invalid' as const };
				return muteUser(staff, text(data, 'userId') ?? '', hours, reasonOf(data));
			},
			purgeComments
		),
	ban: (event) =>
		act(
			event,
			'ban',
			commentKey,
			(staff, data) => banAccount(staff, text(data, 'userId') ?? '', reasonOf(data)),
			purgeComments
		),
	countReport: (event) =>
		act(event, 'countReport', reportKey, (staff, data) =>
			approveReport(staff, text(data, 'userId') ?? '', text(data, 'titleId') ?? '')
		),
	rejectReport: (event) =>
		act(event, 'rejectReport', reportKey, (staff, data) =>
			rejectReport(staff, text(data, 'userId') ?? '', text(data, 'titleId') ?? '')
		),
	rejectAccountReports: (event) =>
		act(event, 'rejectAccountReports', accountKey, (staff, data) =>
			rejectAccountReports(staff, text(data, 'userId') ?? '')
		),
	resolveFlag: (event) =>
		act(event, 'resolveFlag', flagKey, async (staff, data) =>
			flagResult(await resolveCountFlag(text(data, 'id') ?? '', staff.id))
		),
	dismissFlag: (event) =>
		act(event, 'dismissFlag', flagKey, async (staff, data) =>
			flagResult(await dismissCountFlag(text(data, 'id') ?? '', staff.id))
		)
};
