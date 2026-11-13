import { STAFF_ROLES } from '#lib/media/utils/staff.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { purgeTitleComments } from '#lib/server/http/purge-title.ts';
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
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';
import { MODERATION_REASON_MAX, MUTE_HOURS } from '#lib/media/utils/comments.ts';
import { staleSyncSources } from '#lib/media/utils/staleSync.ts';

/**
 * The page and both of its views. `?tab=reports` opens the community-reports tab, and
 * `?title=<id>` opens one title's community reports in it; without a title the tab lists the held
 * reports and the flagged titles.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	await requireRole(locals, STAFF_ROLES, { page: true });
	const titleId = url.searchParams.get('title')?.trim() || null;
	const [pending, reported, recent, held, flagged, openTitle, syncDates] = await Promise.all([
		listPendingQueue(),
		listReportedQueue(),
		listRecentActions(),
		listHeldReports(),
		listFlaggedTitles(),
		titleId ? getOpenTitle(titleId) : null,
		getSourceSyncDates()
	]);
	return {
		tab: url.searchParams.get('tab'),
		titleId,
		pending,
		reported,
		recent,
		held,
		flagged,
		openTitle,
		staleSources: staleSyncSources(syncDates)
	};
};

type InvalidRequest = { ok: false; reason: 'invalid' };

type ActionEvent = Parameters<Actions[string]>[0];

/** The text field `name` of the form, trimmed; empty or absent is null, and a file part is not text. */
function text(data: FormData, name: string): string | null {
	const value = data.get(name);
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const refusals: Record<
	Extract<ModerationResult | ReportModerationResult, { ok: false }>['reason'] | 'invalid',
	[number, string]
> = {
	invalid: [400, 'The request was not valid.'],
	'not-found': [404, 'The comment, report or account no longer exists.'],
	'invalid-state': [409, 'It is no longer in a state this action applies to.'],
	'forbidden-target': [
		403,
		'A moderator can act only on ordinary accounts, an administrator also on moderators; no one acts on an administrator or on their own account.'
	]
};

type Outcome = ModerationResult | ReportModerationResult | InvalidRequest;

/**
 * One moderator action: the guard (403 for anyone else), the rate limit, then `run` over the
 * form. `key` names the row the answer belongs to; `after` runs on success (a comment action
 * purges its title's list there, so the change is public at once). The community-report data
 * functions purge their own counts.
 */
async function act(
	event: ActionEvent,
	name: string,
	key: (data: FormData) => string | null,
	run: (staff: UserRow, data: FormData) => Promise<Outcome> | Outcome,
	after?: (result: Extract<Outcome, { ok: true }>) => void
) {
	const staff = await requireRole(event.locals, STAFF_ROLES);
	await rateLimit(event, 'RL_MODERATE', { userId: staff.id });
	const data = await event.request.formData();
	const target = key(data);
	if (!target) return fail(400, { id: null, error: 'The request had no target.' });

	const result = await run(staff, data);
	if (!result.ok) {
		const [status, message] = refusals[result.reason];
		return fail(status, { id: target, error: message });
	}
	after?.(result);
	return { id: target, done: name };
}

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

export const actions: Actions = {
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
