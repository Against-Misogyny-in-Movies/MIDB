import { accountIdByUsername } from '#lib/server/data/account-view.ts';
import type { LogFilter } from '#lib/server/data/recent-actions.ts';
import { logActionsOf, type LogFilters } from '#lib/media/utils/moderationLog.ts';

export type ResolvedLogFilter = {
	filter: LogFilter;
	/** The filter as `&name=value` pairs for `GET /api/moderation/queue`, by the ids it resolved. */
	params: string;
	/** The usernames no account has: the log filtered by one of them is empty. */
	unknown: ('actor' | 'account')[];
};

/**
 * Turns the log's URL filters into what the queries take: the action group or action as a list of
 * actions, and the two usernames as account ids. A name no account has is reported in `unknown`
 * and the caller lists nothing.
 */
export async function resolveLogFilter(filters: LogFilters): Promise<ResolvedLogFilter> {
	const [actorId, accountId] = await Promise.all([
		filters.actor ? accountIdByUsername(filters.actor) : null,
		filters.account ? accountIdByUsername(filters.account) : null
	]);
	const actions = logActionsOf(filters.action) ?? undefined;
	const unknown: ResolvedLogFilter['unknown'] = [];
	if (filters.actor && !actorId) unknown.push('actor');
	if (filters.account && !accountId) unknown.push('account');
	const params = new URLSearchParams();
	if (actions && filters.action) params.set('action', filters.action);
	if (actorId) params.set('actor', actorId);
	if (accountId) params.set('account', accountId);
	const query = params.toString();
	return {
		filter: { actions, actorId: actorId ?? undefined, accountId: accountId ?? undefined },
		params: query ? `&${query}` : '',
		unknown
	};
}
