/**
 * The shape of every username already stored, for looking one up (`/u/[username]`, the profile
 * comment endpoint): lowercase letters, digits and underscores, 3 to 32 characters. It is not
 * the rule for choosing a name (`NEW_USERNAME_RE`), so no existing address stops resolving.
 */
export const USERNAME_LOOKUP_RE = /^[a-z0-9_]{3,32}$/;

/** The longest a username can be (the `user.username` column and `NEW_USERNAME_RE`). */
export const USERNAME_MAX = 32;

/** The shortest a new or changed username can be. */
export const NEW_USERNAME_MIN = 4;

/**
 * A new or changed username without its length: it starts with a letter, then letters and
 * digits, with single `_` between them, so it never ends in `_`, never has `__`, and is never
 * digits only. It is the profile form's `pattern` too (the browser anchors it).
 */
export const NEW_USERNAME_PATTERN = '[a-z][a-z0-9]*(_[a-z0-9]+)*';

/** The rule for a name being chosen: `NEW_USERNAME_MIN` to `USERNAME_MAX` characters of `NEW_USERNAME_PATTERN`. */
export const NEW_USERNAME_RE = new RegExp(
	`^(?=.{${NEW_USERNAME_MIN},${USERNAME_MAX}}$)${NEW_USERNAME_PATTERN}$`
);

export { foldUsername } from '#db/lib/usernameFold.ts';

/** A username can change once in this many days; staff and an account's first change are exempt. */
export const USERNAME_CHANGE_WAIT_DAYS = 30;

/** A name its owner gave up stays taken for everyone else this many days. */
export const RETIRED_USERNAME_DAYS = 90;
