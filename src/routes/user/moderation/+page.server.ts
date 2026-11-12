import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { purgeTitleComments } from '#lib/server/http/purge-comments.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
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
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import { MODERATION_REASON_MAX, MUTE_HOURS } from '#lib/media/utils/comments.ts';
import { staleSyncSources } from '#lib/media/utils/staleSync.ts';

const STAFF = ['moderator', 'administrator'] as const;

export const load: PageServerLoad = async ({ locals }) => {
	await requireRole(locals, STAFF, { page: true });
	const [pending, reported, recent, syncDates] = await Promise.all([
		listPendingQueue(),
		listReportedQueue(),
		listRecentActions(),
		getSourceSyncDates()
	]);
	return { pending, reported, recent, staleSources: staleSyncSources(syncDates) };
};

type InvalidRequest = { ok: false; reason: 'invalid' };

type ActionEvent = Parameters<Actions[string]>[0];

/** The text field `name` of the form, trimmed; empty or absent is null, and a file part is not text. */
function text(data: FormData, name: string): string | null {
	const value = data.get(name);
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const refusals: Record<
	Extract<ModerationResult, { ok: false }>['reason'] | 'invalid',
	[number, string]
> = {
	invalid: [400, 'The request was not valid.'],
	'not-found': [404, 'The comment or account no longer exists.'],
	'invalid-state': [409, 'The comment is no longer in a state this action applies to.'],
	'forbidden-target': [
		403,
		'A moderator can act only on ordinary accounts, an administrator also on moderators; no one acts on an administrator or on their own account.'
	]
};

/**
 * One moderator action: the guard (403 for anyone else), the rate limit, then `run` over the
 * form. A comment action purges its title's list, so the change is public at once; a user
 * action touches no list.
 */
async function act(
	event: ActionEvent,
	name: string,
	run: (
		staff: UserRow,
		data: FormData
	) => Promise<ModerationResult | InvalidRequest> | ModerationResult | InvalidRequest
) {
	const staff = await requireRole(event.locals, STAFF);
	await rateLimit(event, 'RL_MODERATE', { userId: staff.id });
	const data = await event.request.formData();
	const target = text(data, 'id') ?? text(data, 'userId');
	if (!target) return fail(400, { id: null, error: 'The request had no target.' });

	const result = await run(staff, data);
	if (!result.ok) {
		const [status, message] = refusals[result.reason];
		return fail(status, { id: target, error: message });
	}
	if (result.title) purgeTitleComments(result.title);
	return { id: target, done: name };
}

/** A reason for a hide or a reject, cut to the limit the author's page shows. */
const reasonOf = (data: FormData) => text(data, 'reason')?.slice(0, MODERATION_REASON_MAX) ?? null;

export const actions: Actions = {
	approve: (event) =>
		act(event, 'approve', (staff, data) => approveComment(staff, text(data, 'id') ?? '')),
	hide: (event) =>
		act(event, 'hide', (staff, data) => hideComment(staff, text(data, 'id') ?? '', reasonOf(data))),
	reject: (event) =>
		act(event, 'reject', (staff, data) =>
			rejectComment(staff, text(data, 'id') ?? '', reasonOf(data))
		),
	restore: (event) =>
		act(event, 'restore', (staff, data) => restoreComment(staff, text(data, 'id') ?? '')),
	dismiss: (event) =>
		act(event, 'dismiss', (staff, data) => dismissReports(staff, text(data, 'id') ?? '')),
	mute: (event) =>
		act(event, 'mute', (staff, data) => {
			const hours = Number(text(data, 'hours'));
			if (!MUTE_HOURS.some((h) => h === hours)) return { ok: false, reason: 'invalid' };
			return muteUser(staff, text(data, 'userId') ?? '', hours, reasonOf(data));
		}),
	ban: (event) =>
		act(event, 'ban', (staff, data) =>
			banAccount(staff, text(data, 'userId') ?? '', reasonOf(data))
		)
};
