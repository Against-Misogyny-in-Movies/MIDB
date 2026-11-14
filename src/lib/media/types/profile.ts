import type { TitleKind } from '#lib/server/data/title-queries.ts';
import type { UserCommentRow } from '#lib/media/types/comments.ts';
import type { ContentReportStatus } from '#lib/media/utils/communityReports.ts';
import type { Restriction } from '#lib/media/utils/reportStanding.ts';

/** One published comment on a public profile, with the title it is on. No moderation reason. */
export type ProfileComment = {
	id: string;
	body: string;
	score: number;
	/** ISO timestamp, because the page is cached as JSON. */
	createdAt: string;
	/** Whether the author edited it; the time of the edit is not sent. */
	edited: boolean;
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
	/** The day the account was created, `YYYY-MM-DD` (UTC); never the time. */
	joinedAt: string;
	/** The sum of the scores of the account's published comments. */
	scoreTotal: number;
	/** How many published comments the account has. */
	commentCount: number;
	comments: ProfileCommentPage;
	reports: ProfileReport[];
};

/** One of the reader's own community reports on their profile, in any status, with its standing's inputs. */
export type OwnReport = {
	/** The title's MIDB id: one report per account and title, so it keys the row. */
	titleId: string;
	status: ContentReportStatus;
	kind: TitleKind;
	tmdbId: number | null;
	title: string;
	/** ISO timestamps, because the endpoint answers JSON. */
	updatedAt: string;
	countsFrom: string;
	restricted: Restriction | null;
};

/**
 * What the profile's owner sees beyond the public page (`GET /api/me/profile`): every comment in
 * every status, every community report with its standing, and the account's mute.
 */
export type OwnProfile = {
	comments: UserCommentRow[];
	reports: OwnReport[];
	/** The end of the account's mute while it is in the future; otherwise null. */
	mutedUntil: string | null;
};
