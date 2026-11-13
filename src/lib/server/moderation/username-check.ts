import { normalizeForBlocklist, findBlocklistHit } from './blocklist.ts';

/** A username that contains one of these is refused, wherever it sits in the name. */
const RESERVED_SUBSTRINGS = ['admin', 'moderator', 'midb'] as const;

/** A username with one of these as a whole `_`-separated part is refused. */
const RESERVED_PARTS = new Set([
	'admin',
	'administrator',
	'moderator',
	'mod',
	'midb',
	'support',
	'staff',
	'root'
]);

/**
 * Why a well-formed username (lowercase, `USERNAME_RE`) is refused, else null: `reserved` when
 * it imitates staff or the site, `blocked` when the comment blocklist matches it with `_` read
 * as a word break. The reserved check also reads the name through the blocklist's folding, so
 * `m1db` and `admіn` (Cyrillic i) do not slip past.
 */
export function usernameRefusal(username: string): 'reserved' | 'blocked' | null {
	const forms = [
		username,
		normalizeForBlocklist(username.replaceAll('_', ' ')).replaceAll(' ', '')
	];
	const parts = username.split('_');
	if (
		parts.some((part) => RESERVED_PARTS.has(part)) ||
		forms.some((form) => RESERVED_SUBSTRINGS.some((word) => form.includes(word)))
	) {
		return 'reserved';
	}
	return findBlocklistHit(username.replaceAll('_', ' ')) ? 'blocked' : null;
}
