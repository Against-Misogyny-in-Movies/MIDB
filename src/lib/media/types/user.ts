import type { UserRole } from '$lib/server/data/user-queries';

export type { UserRole };

/**
 * The only user shape that reaches the client (navbar, /api/me, /user/* layout data).
 * Built server-side by `toPublicUser`; never carries the email or the Hanko id.
 */
export type PublicUser = {
	username: string | null;
	avatarKey: string | null;
	role: UserRole;
	/** username → email local-part → "Account", resolved on the server. */
	displayName: string;
};
