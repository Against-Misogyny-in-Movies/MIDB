/** A username is lowercase letters, digits and underscores, 3 to 32 characters. */
export const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

/** The longest a username can be (the `user.username` column and `USERNAME_RE`). */
export const USERNAME_MAX = 32;

/** A username can change once in this many days; staff and an account's first change are exempt. */
export const USERNAME_CHANGE_WAIT_DAYS = 30;

/** A name its owner gave up stays taken for everyone else this many days. */
export const RETIRED_USERNAME_DAYS = 90;
