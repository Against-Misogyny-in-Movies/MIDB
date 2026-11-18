import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { act, text } from '#lib/server/http/moderation-action.ts';
import { addAccountNote, listAccountNotes } from '#lib/server/data/account-notes.ts';
import {
	listAccountComments,
	listAccountReports,
	listReportsAgainst
} from '#lib/server/data/account-lists.ts';
import { getAccountView } from '#lib/server/data/account-view.ts';
import { listRecentActions } from '#lib/server/data/recent-actions.ts';
import { accountKey } from '#lib/server/moderation/action-form.ts';
import { staffActions } from '#lib/server/moderation/staff-actions.ts';
import { canActOn } from '#lib/media/utils/canActOn.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

/**
 * One account as staff see it: standing, figures, the log of every action on it, notes, its
 * comments, its community reports and the open reports against it. Private (the hook's default
 * for `/user/*`). An unknown id is 404; a deleted account reads as its scrubbed standing and the
 * log only. The three lists are read only for a live account, and the notes only for an account
 * the viewer may act on (`canActOn`) and is not themselves: a moderator never reads the notes about
 * an administrator or another moderator, and nobody reads the notes about themselves.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const me = await requireRole(locals, STAFF_ROLES, { page: true });
	const account = await getAccountView(params.id);
	if (!account) error(404, 'Account not found');
	const live = !account.deleted;
	// Notes are read only by staff who may act on the account, and never about oneself.
	const readsNotes = live && account.user.id !== me.id && canActOn(me, account.user);
	const [timeline, notes, comments, reports, against] = await Promise.all([
		listRecentActions(null, undefined, { accountId: account.user.id }),
		readsNotes ? listAccountNotes(account.user.id) : null,
		live ? listAccountComments(account.user.id) : null,
		live ? listAccountReports(account.user.id) : null,
		live ? listReportsAgainst(account.user.id) : null
	]);
	return { account, timeline, notes, comments, reports, against };
};

/** The actions this page's forms post to: the account's, the reversals in its timeline, and notes. */
export const actions: Actions = {
	restore: staffActions.restore,
	mute: staffActions.mute,
	ban: staffActions.ban,
	unmute: staffActions.unmute,
	unban: staffActions.unban,
	rejectAccountReports: staffActions.rejectAccountReports,
	reopenFlag: staffActions.reopenFlag,
	note: (event) =>
		act(event, 'note', accountKey, (staff, data) =>
			addAccountNote(staff, text(data, 'userId') ?? '', text(data, 'body') ?? '')
		)
};
