/** The look-alike characters a username folds: `1` reads as `l` and `0` as `o`. */
export const USERNAME_FOLD = [
	['1', 'l'],
	['0', 'o']
] as const;

/**
 * A username with its look-alikes folded together: lowercase, then each `USERNAME_FOLD` pair.
 * Two names with the same fold are the same name for availability. `usernameFoldedSql.ts` is
 * the SQL form the database indexes.
 */
export function foldUsername(username: string): string {
	let folded = username.toLowerCase();
	for (const [from, to] of USERNAME_FOLD) folded = folded.replaceAll(from, to);
	return folded;
}
