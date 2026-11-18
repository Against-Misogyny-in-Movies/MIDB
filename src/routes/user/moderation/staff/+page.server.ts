import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { act, text } from '#lib/server/http/moderation-action.ts';
import { listStaff, setStaffRole } from '#lib/server/data/staff-roles.ts';
import { purgeOutcome } from '#lib/server/moderation/purge.ts';

const ADMINISTRATORS = ['administrator'] as const;

/**
 * The staff page: administrators and moderators with their role's date. Administrators only
 * (a moderator gets 403), private like every `/user/*` page.
 */
export const load: PageServerLoad = async ({ locals }) => {
	await requireRole(locals, ADMINISTRATORS, { page: true });
	return { staff: await listStaff() };
};

/**
 * Role changes, administrators only. Staff are not rate-limited, like the other moderation
 * actions; the change is logged as `set_role` and the account's profile is purged, since it shows
 * the staff badge.
 */
export const actions: Actions = {
	makeModerator: (event) =>
		act(
			event,
			'makeModerator',
			(data) => text(data, 'username'),
			(staff, data) => setStaffRole(staff, { username: text(data, 'username') ?? '' }, 'moderator'),
			purgeOutcome,
			undefined,
			ADMINISTRATORS
		),
	removeModerator: (event) =>
		act(
			event,
			'removeModerator',
			(data) => text(data, 'userId'),
			(staff, data) => setStaffRole(staff, { id: text(data, 'userId') ?? '' }, 'user'),
			purgeOutcome,
			undefined,
			ADMINISTRATORS
		)
};
