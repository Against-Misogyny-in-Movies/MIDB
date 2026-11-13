import type { TitleKind } from '#lib/server/data/title-queries.ts';

/** One published comment on a public profile, with the title it is on. No moderation reason. */
export type ProfileComment = {
	id: string;
	body: string;
	score: number;
	/** ISO timestamps, because the page is cached as JSON. */
	createdAt: string;
	editedAt: string | null;
	title: { kind: TitleKind; tmdbId: number | null; name: string };
	/** The author of the published comment this one answers, linked to their profile when they have a username. */
	inReplyTo: { displayName: string; username: string | null } | null;
};

/** A page of an account's published comments, newest first. */
export type ProfileCommentPage = {
	comments: ProfileComment[];
	/** Pass back as `cursor` for the next page; null on the last one. */
	nextCursor: string | null;
};

/** A community report that counts, by title. */
export type ProfileReport = {
	kind: TitleKind;
	tmdbId: number | null;
	name: string;
	/** ISO timestamp of the report's last change. */
	updatedAt: string;
};

/**
 * What an account's public page shows (`/u/[username]`): never an email or a user row. The
 * display name is the username, which every account that has a public profile has.
 */
export type PublicProfile = {
	/** The opaque Better Auth id, the same one a comment author carries; it names the cache tag. */
	id: string;
	username: string;
	avatarKey: string | null;
	/** Set for a moderator or an administrator, null for any other account. */
	staffRole: 'moderator' | 'administrator' | null;
	/** ISO timestamp of the account's creation. */
	joinedAt: string;
	/** The sum of the scores of the account's published comments. */
	scoreTotal: number;
	comments: ProfileCommentPage;
	reports: ProfileReport[];
};
