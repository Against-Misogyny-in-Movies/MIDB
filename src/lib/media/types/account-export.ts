import type { TitleKind } from '#lib/server/data/title-queries.ts';
import type { CommentStatus, ReportReason } from '#lib/media/types/comments.ts';
import type {
	ConcernFlagKey,
	ContentReportStatus,
	ObjectificationLevel,
	ReportFraming,
	ReportLevel,
	SexualLevel
} from '#lib/media/utils/communityReports.ts';
import type { UserRole } from '#lib/server/data/user-queries.ts';

/** A film or series by the ids the site uses for it, as a row of the export names it. */
export type ExportTitle = {
	kind: TitleKind;
	tmdbId: number | null;
	name: string;
};

/**
 * The document `GET /api/me/export` downloads: the signed-in account's own data, one JSON
 * file. Times are ISO strings. It carries no token, key or credential id, no moderator's id
 * and nothing of another account.
 */
export type AccountExport = {
	/** Raised when a field is renamed or removed, so a reader of an older file can tell. */
	formatVersion: number;
	exportedAt: string;
	account: {
		username: string | null;
		avatarKey: string | null;
		role: UserRole;
		joinedAt: string;
		/** When the username last changed by a rename; null until the first one. */
		usernameChangedAt: string | null;
		/** The end of the account's mute while it is in the future; otherwise null. */
		mutedUntil: string | null;
		/** The email the account was created with; null when it has none. */
		email: string | null;
		/** Usernames the account gave up and that are still held back from others. */
		retiredUsernames: { username: string; retiredAt: string }[];
	};
	signInMethods: {
		linkedAccounts: { provider: string; addedAt: string }[];
		passkeys: {
			label: string | null;
			deviceType: string;
			syncedAcrossDevices: boolean;
			addedAt: string;
		}[];
	};
	sessions: {
		startedAt: string;
		expiresAt: string;
		ipAddress: string | null;
		userAgent: string | null;
	}[];
	comments: {
		id: string;
		title: ExportTitle;
		/** The comment this one answers; null on a root. */
		parentId: string | null;
		body: string;
		status: CommentStatus;
		/** Why a comment was rejected or hidden: the reason the author sees on the profile. */
		moderationReason: string | null;
		score: number;
		createdAt: string;
		editedAt: string | null;
	}[];
	communityReports: {
		title: ExportTitle;
		status: ContentReportStatus;
		/** Why a report is held; null on any other status. */
		holdReason: string | null;
		answers: {
			sexualViolence: SexualLevel | null;
			partnerOrFamilyAbuse: ReportLevel | null;
			physicalViolence: ReportLevel | null;
			stalking: ReportLevel | null;
			objectification: ObjectificationLevel | null;
			framing: ReportFraming | null;
			/** The Unconsenting Media concern flags; null is not sure. */
			concerns: Record<ConcernFlagKey, boolean | null>;
		};
		createdAt: string;
		updatedAt: string;
	}[];
	votes: { commentId: string; value: 1 | -1 }[];
	/** Reports the account made on other readers' comments. */
	commentReports: {
		commentId: string;
		reason: ReportReason;
		note: string | null;
		status: 'open' | 'resolved' | 'dismissed';
		createdAt: string;
	}[];
	/** "Counts look wrong" flags the account raised on a title's community report counts. */
	countFlags: {
		title: ExportTitle;
		note: string | null;
		status: 'open' | 'resolved' | 'dismissed';
		createdAt: string;
	}[];
};
