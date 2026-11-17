import { MODERATION_REASON_MAX, MUTE_HOURS } from '#lib/media/utils/comments.ts';
import { TABLE_PAGE_SIZE } from '#lib/media/utils/moderationFilters.ts';
import { muteUser } from '#lib/server/data/moderation-actions.ts';
import type { FlagCloseResult } from '#lib/server/data/count-flags.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { text, type Outcome } from '#lib/server/http/moderation-action.ts';

/**
 * A comment action answers for the comment row, or for the account row when it names only an
 * account.
 */
export const commentKey = (data: FormData) => text(data, 'id') ?? text(data, 'userId');
export const accountKey = (data: FormData) => text(data, 'userId');
export const flagKey = (data: FormData) => text(data, 'id');
export const reportKey = (data: FormData) => {
	const userId = text(data, 'userId');
	const titleId = text(data, 'titleId');
	return userId && titleId ? `${userId}:${titleId}` : null;
};

/** A reason for a hide, a reject, a mute or a ban, cut to the limit the author's page shows. */
export const reasonOf = (data: FormData) =>
	text(data, 'reason')?.slice(0, MODERATION_REASON_MAX) ?? null;

/** The distinct comment ids of the form's `ids` fields; null when none, or more than a page. */
export function pageIds(data: FormData): string[] | null {
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

/** A closed flag changes no counts, so it names no title; a flag that was not open is refused. */
export const flagResult = (closed: FlagCloseResult): Outcome =>
	closed.ok ? { ok: true, purge: {} } : closed;

/** A mute for one of the lengths in `MUTE_HOURS`; any other length is refused. */
export function muteFromForm(staff: UserRow, data: FormData): Outcome | Promise<Outcome> {
	const hours = Number(text(data, 'hours'));
	if (!MUTE_HOURS.some((h) => h === hours)) return { ok: false, reason: 'invalid' as const };
	return muteUser(staff, text(data, 'userId') ?? '', hours, reasonOf(data));
}
