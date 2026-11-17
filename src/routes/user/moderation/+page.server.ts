import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import {
	act,
	text,
	viewedEditedAt,
	withViewedEditedAt,
	type Outcome
} from '#lib/server/http/moderation-action.ts';
import { env } from '#lib/server/env.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	rejectComment,
	restoreComment
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
import { queryToFilters } from '#lib/server/moderation/search-filters.ts';
import {
	accountKey,
	commentKey,
	flagKey,
	flagResult,
	muteFromForm,
	reasonOf,
	reportKey
} from '#lib/server/moderation/action-form.ts';
import { runBulk } from '#lib/server/moderation/bulk.ts';
import { purgeOutcome } from '#lib/server/moderation/purge.ts';
import { runScan } from '#lib/server/moderation/run-scan.ts';
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import { AI_QUERY_MAX } from '#lib/media/utils/comments.ts';
import { filtersToParams, parseFilters } from '#lib/media/utils/moderationFilters.ts';
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
	scan: (event) => act(event, 'scan', () => 'scan', runScan, undefined, 'RL_MODERATE_AI'),
	bulk: (event) => act(event, 'bulk', () => 'bulk', runBulk),
	approve: (event) =>
		act(
			event,
			'approve',
			commentKey,
			(staff, data) =>
				withViewedEditedAt(viewedEditedAt(data), (editedAt) =>
					approveComment(staff, text(data, 'id') ?? '', editedAt)
				),
			purgeOutcome
		),
	hide: (event) =>
		act(
			event,
			'hide',
			commentKey,
			(staff, data) => hideComment(staff, text(data, 'id') ?? '', reasonOf(data)),
			purgeOutcome
		),
	reject: (event) =>
		act(
			event,
			'reject',
			commentKey,
			(staff, data) => rejectComment(staff, text(data, 'id') ?? '', reasonOf(data)),
			purgeOutcome
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
			purgeOutcome
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
			purgeOutcome
		),
	mute: (event) => act(event, 'mute', commentKey, muteFromForm, purgeOutcome),
	ban: (event) =>
		act(
			event,
			'ban',
			commentKey,
			(staff, data) => banAccount(staff, text(data, 'userId') ?? '', reasonOf(data)),
			purgeOutcome
		),
	countReport: (event) =>
		act(
			event,
			'countReport',
			reportKey,
			(staff, data) =>
				approveReport(staff, text(data, 'userId') ?? '', text(data, 'titleId') ?? ''),
			purgeOutcome
		),
	rejectReport: (event) =>
		act(
			event,
			'rejectReport',
			reportKey,
			(staff, data) => rejectReport(staff, text(data, 'userId') ?? '', text(data, 'titleId') ?? ''),
			purgeOutcome
		),
	rejectAccountReports: (event) =>
		act(
			event,
			'rejectAccountReports',
			accountKey,
			(staff, data) => rejectAccountReports(staff, text(data, 'userId') ?? ''),
			purgeOutcome
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
