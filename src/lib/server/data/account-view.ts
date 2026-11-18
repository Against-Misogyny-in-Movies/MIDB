import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { commentReports, comments, communityContentReports } from '#db/schema/community.ts';
import { users } from '#db/schema/auth.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { activeMute } from './mute.ts';
import { accountsMutedByModerator } from './moderation-target.ts';
import { reporterRecords, type ReporterRecord } from './reporter-record.ts';
import { toPublicUser } from './user-queries.ts';

/** The numbers an account's page shows, as totals in the database. */
export type AccountFigures = {
	/** Every comment the account wrote, whatever its status. */
	comments: number;
	/** Those now hidden or rejected. */
	hiddenOrRejected: number;
	/** Open reports against its comments. */
	openReportsAgainst: number;
	/** Its community reports, whatever their status. */
	communityReports: number;
	/** Those that are not rejected, which "Reject all community reports" would reject. */
	communityReportsLive: number;
	/** How its own comment reports fared (`reporter-record.ts`). */
	reportsMade: ReporterRecord;
};

/** One account as the staff page about it shows it. */
export type AccountView = {
	user: PublicUser;
	/** When the account was created (ISO). */
	joinedAt: string;
	/** A deleted account is scrubbed: no name, no comments; only its log remains. */
	deleted: boolean;
	/** When the mute ends, while it is in the future. */
	mutedUntil: string | null;
	/** Whether a moderator set the latest mute, which a moderator may end (`muteSetByModerator`). */
	mutedByModerator: boolean;
	banned: { at: string; reason: string | null } | null;
	/** Null for a deleted account. */
	figures: AccountFigures | null;
};

const total = sql<number>`count(*)`;

/** The figures of a live account. */
async function figuresOf(id: string): Promise<AccountFigures> {
	const [all, withheld, against, community, records] = await Promise.all([
		db.select({ n: total }).from(comments).where(eq(comments.userId, id)),
		db
			.select({ n: total })
			.from(comments)
			.where(and(eq(comments.userId, id), inArray(comments.status, ['hidden', 'rejected']))),
		db
			.select({ n: total })
			.from(commentReports)
			.innerJoin(comments, eq(commentReports.commentId, comments.id))
			.where(and(eq(comments.userId, id), eq(commentReports.status, 'open'))),
		db
			.select({
				n: total,
				live: sql<number>`coalesce(sum(CASE WHEN ${ne(communityContentReports.status, 'rejected')} THEN 1 ELSE 0 END), 0)`
			})
			.from(communityContentReports)
			.where(eq(communityContentReports.userId, id)),
		reporterRecords([id])
	]);
	return {
		comments: all[0].n,
		hiddenOrRejected: withheld[0].n,
		openReportsAgainst: against[0].n,
		communityReports: community[0].n,
		communityReportsLive: community[0].live,
		reportsMade: records.get(id) ?? { total: 0, upheld: 0, dismissed: 0 }
	};
}

/** The account with that opaque id, or null when there is none. */
export async function getAccountView(id: string): Promise<AccountView | null> {
	const [row] = await db.select().from(users).where(eq(users.id, id));
	if (!row) return null;
	const deleted = row.deletedAt !== null;
	const mutedUntil = activeMute(row.mutedUntil);
	const mutedByModerator = mutedUntil ? (await accountsMutedByModerator([id])).has(id) : false;
	return {
		user: toPublicUser(row),
		joinedAt: row.createdAt.toISOString(),
		deleted,
		mutedUntil,
		mutedByModerator,
		banned: row.bannedAt ? { at: row.bannedAt.toISOString(), reason: row.banReason } : null,
		figures: deleted ? null : await figuresOf(id)
	};
}
