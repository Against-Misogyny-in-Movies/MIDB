import type { Actions } from '@sveltejs/kit';
import {
	act,
	text,
	viewedEditedAt,
	withViewedEditedAt
} from '#lib/server/http/moderation-action.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import {
	approveReport,
	rejectAccountReports,
	rejectReport
} from '#lib/server/data/community-report-moderation.ts';
import { unbanAccount, unmuteUser } from '#lib/server/data/moderation-reversals.ts';
import {
	accountKey,
	commentKey,
	flagKey,
	flagResult,
	muteFromForm,
	reasonOf,
	reportKey,
	withRule
} from '#lib/server/moderation/action-form.ts';
import { purgeOutcome } from '#lib/server/moderation/purge.ts';
import {
	dismissCountFlag,
	reopenCountFlag,
	resolveCountFlag
} from '#lib/server/data/count-flags.ts';

/**
 * The form actions on comments, accounts, community reports and flags that the moderation queue
 * and an account's page both post to (`?/hide`, `?/unmute`, ...). Each is `act` over one data
 * function: the guard, the target key, the write and the cache purge. A page exports the ones its
 * forms post to as its own `actions`.
 */
export const staffActions = {
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
			(staff, data) =>
				withRule(data, (rule) => hideComment(staff, text(data, 'id') ?? '', reasonOf(data), rule)),
			purgeOutcome
		),
	reject: (event) =>
		act(
			event,
			'reject',
			commentKey,
			(staff, data) =>
				withRule(data, (rule) =>
					rejectComment(staff, text(data, 'id') ?? '', reasonOf(data), rule)
				),
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
			(staff, data) =>
				withRule(data, (rule) =>
					banAccount(staff, text(data, 'userId') ?? '', reasonOf(data), rule)
				),
			purgeOutcome
		),
	unmute: (event) =>
		act(
			event,
			'unmute',
			commentKey,
			(staff, data) => unmuteUser(staff, text(data, 'userId') ?? '', reasonOf(data)),
			purgeOutcome
		),
	unban: (event) =>
		act(
			event,
			'unban',
			commentKey,
			(staff, data) => unbanAccount(staff, text(data, 'userId') ?? '', reasonOf(data)),
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
		),
	reopenFlag: (event) =>
		act(event, 'reopenFlag', flagKey, async (staff, data) =>
			flagResult(await reopenCountFlag(text(data, 'id') ?? '', staff))
		)
} satisfies Actions;
