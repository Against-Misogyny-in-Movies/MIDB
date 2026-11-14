import type { Actions, PageServerLoad } from './$types';
import type { EditedAt } from '#lib/server/data/comment-status.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { requireRole } from '#lib/server/auth/guards.ts';
import { purgeProfiles, purgeTitleComments } from '#lib/server/http/purge-title.ts';
import {
	act,
	text,
	viewedEditedAt,
	withViewedEditedAt,
	type ActionEvent,
	type Outcome
} from '#lib/server/http/moderation-action.ts';
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
	rejectReport
} from '#lib/server/data/community-report-moderation.ts';
import {
	getOpenTitle,
	listFlaggedTitles,
	listHeldReports
} from '#lib/server/data/community-report-queue.ts';
import { listModerationTable } from '#lib/server/data/moderation-table.ts';
import { listScanItems, saveScanLabels } from '#lib/server/data/comment-ai-labels.ts';
import { queryToFilters } from '#lib/server/moderation/search-filters.ts';
import { scanComments } from '#lib/server/moderation/scan.ts';
import {
	dismissCountFlag,
	resolveCountFlag,
	type FlagCloseResult
} from '#lib/server/data/count-flags.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import {
	AI_QUERY_MAX,
	MODERATION_REASON_MAX,
	MUTE_HOURS,
	SCAN_CONCERN_MAX
} from '#lib/media/utils/comments.ts';
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

/**
 * A comment action answers for the comment row, or for the account row when it names only an
 * account.
 */
const commentKey = (data: FormData) => text(data, 'id') ?? text(data, 'userId');
const accountKey = (data: FormData) => text(data, 'userId');
const flagKey = (data: FormData) => text(data, 'id');
const reportKey = (data: FormData) => {
	const userId = text(data, 'userId');
	const titleId = text(data, 'titleId');
	return userId && titleId ? `${userId}:${titleId}` : null;
};

/**
 * A comment action's title list is purged once it succeeds, and so are its author's profile and
 * those of its published replies when the action changed what they show; a user action has no
 * title (mute and ban purge the profile themselves).
 */
const purgeComments = (result: Extract<Outcome, { ok: true }>) => {
	if ('title' in result && result.title) purgeTitleComments(result.title);
	if ('authorId' in result && result.authorId) {
		purgeProfiles([result.authorId, ...(result.replyAuthorIds ?? [])]);
	}
};

/** A closed flag changes no counts, so it names no title; a flag that was not open is refused. */
const flagResult = (closed: FlagCloseResult): Outcome =>
	closed.ok ? { ok: true, titles: [] } : closed;

/** A reason for a hide or a reject, cut to the limit the author's page shows. */
const reasonOf = (data: FormData) => text(data, 'reason')?.slice(0, MODERATION_REASON_MAX) ?? null;

/** What a bulk operation reads for one comment: the reason, and the `editedAt` its row showed. */
type BulkInput = { reason: string | null; editedAt: EditedAt | undefined };

/**
 * The five operations a bulk action applies to each comment, by the single-comment functions.
 * The operations that publish need the row's `editedAt` (`withViewedEditedAt`); a row without one
 * is refused.
 */
const BULK_OPS = {
	approve: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => approveComment(staff, id, viewed)),
	hide: (staff, id, { reason }) => hideComment(staff, id, reason),
	reject: (staff, id, { reason }) => rejectComment(staff, id, reason),
	restore: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => restoreComment(staff, id, viewed)),
	dismiss: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => dismissReports(staff, id, viewed))
} satisfies Record<
	string,
	(
		staff: UserRow,
		id: string,
		input: BulkInput
	) => Promise<ModerationResult | { ok: false; reason: 'invalid' }>
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
 * Applies one operation to each comment in turn. The result counts the comments applied, refused
 * and, of those refused, edited since the page loaded.
 * Each function checks the comment's state and
 * the author's standing itself, so a refusal costs only its own comment. Every title touched and
 * every profile (the authors' and those of their published replies) is purged once, however many
 * comments changed, and also when a later write throws: the changes already made are public by
 * then.
 */
function bulk(event: ActionEvent) {
	return act(
		event,
		'bulk',
		() => 'bulk',
		async (staff, data): Promise<Outcome> => {
			const op = text(data, 'op');
			const ids = pageIds(data);
			if (!isBulkOp(op) || !ids) return { ok: false, reason: 'invalid' };
			const reason = reasonOf(data);
			const touched = new Map<
				string,
				NonNullable<Extract<ModerationResult, { ok: true }>['title']>
			>();
			const authors = new Set<string>();
			let applied = 0;
			let edited = 0;
			try {
				for (const id of ids) {
					const result = await BULK_OPS[op](staff, id, {
						reason,
						editedAt: viewedEditedAt(data, `editedAt.${id}`)
					});
					if (!result.ok) {
						if (result.reason === 'edited') edited += 1;
						continue;
					}
					applied += 1;
					if (result.title) touched.set(result.title.id, result.title);
					if (result.authorId) authors.add(result.authorId);
					for (const id of result.replyAuthorIds ?? []) authors.add(id);
				}
			} finally {
				for (const title of touched.values()) purgeTitleComments(title);
				purgeProfiles(authors);
			}
			if (applied === 0) return { ok: false, reason: 'bulk-unchanged' };
			return { ok: true, extra: { op, applied, refused: ids.length - applied, edited } };
		}
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
				if (!ids) return { ok: false, reason: 'invalid' };
				if (!concern || concern.length > SCAN_CONCERN_MAX) {
					return { ok: false, reason: 'invalid-concern' };
				}
				const items = await listScanItems(ids);
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
			(staff, data) =>
				withViewedEditedAt(viewedEditedAt(data), (editedAt) =>
					approveComment(staff, text(data, 'id') ?? '', editedAt)
				),
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
			(staff, data) =>
				withViewedEditedAt(viewedEditedAt(data), (editedAt) =>
					restoreComment(staff, text(data, 'id') ?? '', editedAt)
				),
			purgeComments
		),
	dismiss: (event) =>
		act(
			event,
			'dismiss',
			commentKey,
			(staff, data) =>
				withViewedEditedAt(viewedEditedAt(data), (editedAt) =>
					dismissReports(staff, text(data, 'id') ?? '', editedAt)
				),
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
			flagResult(await resolveCountFlag(text(data, 'id') ?? '', staff))
		),
	dismissFlag: (event) =>
		act(event, 'dismissFlag', flagKey, async (staff, data) =>
			flagResult(await dismissCountFlag(text(data, 'id') ?? '', staff))
		)
};
