/** A username is lowercase letters, digits and underscores, 3 to 32 characters. */
export const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

/** The longest a username can be (the `user.username` column and `USERNAME_RE`). */
export const USERNAME_MAX = 32;
