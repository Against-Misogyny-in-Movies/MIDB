import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { act, text, type Outcome } from '#lib/server/http/moderation-action.ts';
import { env } from '#lib/server/env.ts';
import { listPendingQueue, listReportedQueue } from '#lib/server/data/moderation-queue.ts';
import { listRecentActions } from '#lib/server/data/recent-actions.ts';
import {
	getOpenTitle,
	listFlaggedTitles,
	listHeldReports
} from '#lib/server/data/community-report-queue.ts';
import { getModerationCounts } from '#lib/server/data/moderation-counts.ts';
import { listModerationTable } from '#lib/server/data/moderation-table.ts';
import { queryToFilters } from '#lib/server/moderation/search-filters.ts';
import { staffActions } from '#lib/server/moderation/staff-actions.ts';
import { runBulk } from '#lib/server/moderation/bulk.ts';
import { runScan } from '#lib/server/moderation/run-scan.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import { AI_QUERY_MAX } from '#lib/media/utils/comments.ts';
import { filtersToParams, parseFilters } from '#lib/media/utils/moderationFilters.ts';
import { staleSyncSources } from '#lib/media/utils/staleSync.ts';
import { parseLogFilters } from '#lib/media/utils/moderationLog.ts';
import { resolveLogFilter } from '#lib/server/moderation/log-filter.ts';
import { parseModerationTab } from '#lib/media/utils/moderationTabs.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

/**
 * The page. `?tab=` names the open tab (`parseModerationTab`; Pending without one), and the load
 * runs only that tab's list, plus the counts every badge shows and the sync dates the stale-source
 * notice reads. `?title=<id>` opens one title's community reports in the reports tab, in place of
 * its held and flagged lists. `?tab=table` takes the table's filters from the same query (its
 * `title` filter is a name, so it opens no title's reports).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	await requireRole(locals, STAFF_ROLES, { page: true });
	const params = url.searchParams;
	const tab = parseModerationTab(params.get('tab'), !!params.get('title')?.trim());
	const titleId = tab === 'reports' ? params.get('title')?.trim() || null : null;
	const filters = tab === 'table' ? parseFilters(params) : null;
	const logFilters = tab === 'log' ? parseLogFilters(params) : null;
	const log = logFilters ? await resolveLogFilter(logFilters) : null;
	const openList = tab === 'reports' && !titleId;
	const [counts, syncDates, pending, reported, recent, held, flagged, openTitle, table] =
		await Promise.all([
			getModerationCounts(),
			getSourceSyncDates(),
			tab === 'pending' ? listPendingQueue() : null,
			tab === 'reported' ? listReportedQueue() : null,
			log
				? log.unknown.length > 0
					? { items: [], nextCursor: null }
					: listRecentActions(null, undefined, log.filter)
				: null,
			openList ? listHeldReports() : null,
			openList ? listFlaggedTitles() : null,
			titleId ? getOpenTitle(titleId) : null,
			filters ? listModerationTable(filters) : null
		]);
	return {
		tab,
		titleId,
		counts,
		// Only the open tab's list is read; the rest are null.
		pending,
		reported,
		recent,
		// The log's filters as typed, the ids they resolved to for further pages, and the names no account has.
		logFilters,
		logParams: log?.params ?? '',
		unknownNames: log?.unknown ?? [],
		held,
		flagged,
		openTitle,
		staleSources: staleSyncSources(syncDates),
		table,
		filters,
		// Whether the AI controls work; never the key itself.
		aiAvailable: tab === 'table' && !!env.ANTHROPIC_API_KEY
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
	...staffActions
};
