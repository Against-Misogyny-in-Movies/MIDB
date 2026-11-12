import type { UserRole } from '#lib/server/data/user-queries.ts';

export type { UserRole };

/**
 * The only user shape that reaches the client (navbar, /api/me, /user/* layout data).
 * Built server-side by `toPublicUser`; never carries the email.
 */
export type PublicUser = {
	/** The Better Auth user id, opaque. It lets the client recognise the user's own comments in lists that are the same for everyone. */
	id: string;
	username: string | null;
	avatarKey: string | null;
	role: UserRole;
	/** username → email local-part → "Account", resolved on the server. */
	displayName: string;
};
