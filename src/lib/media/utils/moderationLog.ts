import { moderationAction } from '#lib/media/utils/comments.ts';

export type LogAction = (typeof moderationAction)[number];

/** How an action reads as a filter option. */
export const LOG_ACTION_LABELS: Record<LogAction, string> = {
	approve: 'Approve comment',
	hide: 'Hide comment',
	reject: 'Reject comment',
	restore: 'Restore comment',
	dismiss: 'Dismiss reports',
	mute: 'Mute account',
	unmute: 'End mute',
	ban: 'Ban account',
	unban: 'Lift ban',
	approve_report: 'Count community report',
	reject_report: 'Reject community report',
	reject_account_reports: 'Reject all community reports',
	resolve_count_flag: 'Resolve Counts look wrong',
	dismiss_count_flag: 'Dismiss Counts look wrong',
	reopen_flag: 'Re-open Counts look wrong',
	set_role: 'Change role',
	note: 'Add note'
};

/** The groups the log's action filter offers, each a set of actions; together they hold every action once. */
export const LOG_ACTION_GROUPS = [
	{
		id: 'comments',
		label: 'Comments',
		actions: ['approve', 'hide', 'reject', 'restore', 'dismiss']
	},
	{
		id: 'restrictions',
		label: 'Mutes and bans',
		actions: ['mute', 'unmute', 'ban', 'unban']
	},
	{
		id: 'reports',
		label: 'Community reports and Counts look wrong',
		actions: [
			'approve_report',
			'reject_report',
			'reject_account_reports',
			'resolve_count_flag',
			'dismiss_count_flag',
			'reopen_flag'
		]
	},
	{ id: 'roles', label: 'Roles and notes', actions: ['set_role', 'note'] }
] as const satisfies readonly { id: string; label: string; actions: readonly LogAction[] }[];

/** The longest username a log filter takes. */
export const LOG_NAME_MAX = 32;

/** What the log filters on, as typed: a group id or one action, and two usernames. */
export type LogFilters = {
	action: string | null;
	/** The staff member's username. */
	actor: string | null;
	/** The username of the account the action concerned. */
	account: string | null;
};

/**
 * The actions an `action` filter value stands for: a group's id, or one action. Anything else
 * (an unknown value, a hand-edited URL) is null, which filters nothing.
 */
export function logActionsOf(value: string | null): readonly LogAction[] | null {
	if (value === null) return null;
	const group = LOG_ACTION_GROUPS.find((g) => g.id === value);
	if (group) return group.actions;
	const action = moderationAction.find((a) => a === value);
	return action ? [action] : null;
}

/** What an `action` filter value reads as in a chip, or null when it is not one. */
export function logActionLabel(value: string | null): string | null {
	if (value === null) return null;
	const group = LOG_ACTION_GROUPS.find((g) => g.id === value);
	if (group) return group.label;
	const action = moderationAction.find((a) => a === value);
	return action ? LOG_ACTION_LABELS[action] : null;
}

const name = (params: URLSearchParams, key: string) => {
	const value = params.get(key)?.trim().slice(0, LOG_NAME_MAX);
	return value || null;
};

/** The log filters of a URL; an unknown action reads as none. */
export function parseLogFilters(params: URLSearchParams): LogFilters {
	const action = params.get('action');
	return {
		action: logActionsOf(action) ? action : null,
		actor: name(params, 'actor'),
		account: name(params, 'account')
	};
}

/** The log's URL for a filter set: `?tab=log` and the filters that are set. */
export function logHref(filters: LogFilters): string {
	const params = new URLSearchParams({ tab: 'log' });
	if (filters.action) params.set('action', filters.action);
	if (filters.actor) params.set('actor', filters.actor);
	if (filters.account) params.set('account', filters.account);
	return `?${params}`;
}

/** An active filter, and the log's URL with just that filter taken off. */
export type LogChip = { key: keyof LogFilters; label: string; href: string };

export function logChips(filters: LogFilters): LogChip[] {
	const chips: LogChip[] = [];
	const without = (key: keyof LogFilters) => logHref({ ...filters, [key]: null });
	const actionLabel = logActionLabel(filters.action);
	if (actionLabel)
		chips.push({ key: 'action', label: `Action: ${actionLabel}`, href: without('action') });
	if (filters.actor)
		chips.push({ key: 'actor', label: `Staff: ${filters.actor}`, href: without('actor') });
	if (filters.account) {
		chips.push({ key: 'account', label: `Account: ${filters.account}`, href: without('account') });
	}
	return chips;
}
