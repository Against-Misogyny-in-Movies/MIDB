import { asc, desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { accounts, passkeys, retiredUsernames, sessions } from '#db/schema/auth.ts';
import {
	commentReports,
	commentVotes,
	communityContentReports as reports,
	comments,
	titleCountFlags
} from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import type { AccountExport, ExportTitle } from '#lib/media/types/account-export.ts';
import { CONCERN_FLAGS, type ConcernFlagKey } from '#lib/media/utils/communityReports.ts';
import { realEmail } from '#lib/server/auth/placeholder-email.ts';
import { activeMute } from './mute.ts';
import type { UserRow } from './user-queries.ts';

/** `AccountExport.formatVersion`: raised when a field is renamed or removed. */
export const ACCOUNT_EXPORT_VERSION = 1;

const titleColumns = { kind: titles.kind, tmdbId: titles.tmdbId, name: titles.title };

const iso = (date: Date): string => date.toISOString();
const isoOrNull = (date: Date | null): string | null => (date ? date.toISOString() : null);
const title = (row: ExportTitle): ExportTitle => ({
	kind: row.kind,
	tmdbId: row.tmdbId,
	name: row.name
});

/**
 * Everything the account holder is allowed to take with them, read by their user id alone. Each
 * query names its columns: a session token, a passkey's public key or credential id, a linked
 * account's tokens, the moderator who resolved a report or the classifier's internals are never
 * selected. Another account appears nowhere; a comment or report is named by its own id.
 *
 * @param user - The signed-in account's row.
 * @param now - The export time.
 */
export async function buildAccountExport(
	user: Pick<
		UserRow,
		| 'id'
		| 'email'
		| 'username'
		| 'avatarKey'
		| 'role'
		| 'createdAt'
		| 'usernameChangedAt'
		| 'mutedUntil'
	>,
	now: Date = new Date()
): Promise<AccountExport> {
	const [
		retired,
		linked,
		keys,
		sessionRows,
		commentRows,
		reportRows,
		voteRows,
		commentReportRows,
		flagRows
	] = await Promise.all([
		db
			.select({ username: retiredUsernames.username, retiredAt: retiredUsernames.retiredAt })
			.from(retiredUsernames)
			.where(eq(retiredUsernames.userId, user.id))
			.orderBy(desc(retiredUsernames.retiredAt), retiredUsernames.username),
		db
			.select({ provider: accounts.providerId, addedAt: accounts.createdAt })
			.from(accounts)
			.where(eq(accounts.userId, user.id))
			.orderBy(asc(accounts.createdAt), accounts.id),
		db
			.select({
				label: passkeys.name,
				deviceType: passkeys.deviceType,
				backedUp: passkeys.backedUp,
				addedAt: passkeys.createdAt
			})
			.from(passkeys)
			.where(eq(passkeys.userId, user.id))
			.orderBy(asc(passkeys.createdAt), passkeys.id),
		db
			.select({
				startedAt: sessions.createdAt,
				expiresAt: sessions.expiresAt,
				ipAddress: sessions.ipAddress,
				userAgent: sessions.userAgent
			})
			.from(sessions)
			.where(eq(sessions.userId, user.id))
			.orderBy(desc(sessions.createdAt), sessions.id),
		db
			.select({
				id: comments.id,
				parentId: comments.parentId,
				body: comments.body,
				status: comments.status,
				moderationReason: comments.moderationReason,
				score: comments.score,
				createdAt: comments.createdAt,
				editedAt: comments.editedAt,
				...titleColumns
			})
			.from(comments)
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(eq(comments.userId, user.id))
			.orderBy(desc(comments.createdAt), desc(comments.id)),
		db
			.select({ report: reports, ...titleColumns })
			.from(reports)
			.innerJoin(titles, eq(reports.titleId, titles.id))
			.where(eq(reports.userId, user.id))
			.orderBy(desc(reports.updatedAt), desc(reports.titleId)),
		db
			.select({ commentId: commentVotes.commentId, value: commentVotes.value })
			.from(commentVotes)
			.where(eq(commentVotes.userId, user.id))
			.orderBy(desc(commentVotes.updatedAt), commentVotes.commentId),
		db
			.select({
				commentId: commentReports.commentId,
				reason: commentReports.reason,
				note: commentReports.note,
				status: commentReports.status,
				createdAt: commentReports.createdAt
			})
			.from(commentReports)
			.where(eq(commentReports.reporterId, user.id))
			.orderBy(desc(commentReports.createdAt), commentReports.id),
		db
			.select({
				note: titleCountFlags.note,
				status: titleCountFlags.status,
				createdAt: titleCountFlags.createdAt,
				...titleColumns
			})
			.from(titleCountFlags)
			.innerJoin(titles, eq(titleCountFlags.titleId, titles.id))
			.where(eq(titleCountFlags.reporterId, user.id))
			.orderBy(desc(titleCountFlags.createdAt), titleCountFlags.id)
	]);

	return {
		formatVersion: ACCOUNT_EXPORT_VERSION,
		exportedAt: iso(now),
		account: {
			username: user.username,
			avatarKey: user.avatarKey,
			role: user.role,
			joinedAt: iso(user.createdAt),
			usernameChangedAt: isoOrNull(user.usernameChangedAt),
			mutedUntil: activeMute(user.mutedUntil),
			email: realEmail(user),
			retiredUsernames: retired.map((row) => ({
				username: row.username,
				retiredAt: iso(row.retiredAt)
			}))
		},
		signInMethods: {
			linkedAccounts: linked.map((row) => ({ provider: row.provider, addedAt: iso(row.addedAt) })),
			passkeys: keys.map((row) => ({
				label: row.label,
				deviceType: row.deviceType,
				syncedAcrossDevices: row.backedUp,
				addedAt: iso(row.addedAt)
			}))
		},
		sessions: sessionRows.map((row) => ({
			startedAt: iso(row.startedAt),
			expiresAt: iso(row.expiresAt),
			ipAddress: row.ipAddress,
			userAgent: row.userAgent
		})),
		comments: commentRows.map((row) => ({
			id: row.id,
			title: title(row),
			parentId: row.parentId,
			body: row.body,
			status: row.status,
			moderationReason: row.moderationReason,
			score: row.score,
			createdAt: iso(row.createdAt),
			editedAt: isoOrNull(row.editedAt)
		})),
		communityReports: reportRows.map(({ report, ...ref }) => ({
			title: title(ref),
			status: report.status,
			holdReason: report.holdReason,
			answers: {
				sexualViolence: report.sexualPresent,
				partnerOrFamilyAbuse: report.partnerLevel,
				physicalViolence: report.physicalLevel,
				stalking: report.stalkingLevel,
				objectification: report.objectificationLevel,
				framing: report.framing,
				concerns: Object.fromEntries(CONCERN_FLAGS.map(({ key }) => [key, report[key]])) as Record<
					ConcernFlagKey,
					boolean | null
				>
			},
			createdAt: iso(report.createdAt),
			updatedAt: iso(report.updatedAt)
		})),
		votes: voteRows.map((row) => ({ commentId: row.commentId, value: row.value === 1 ? 1 : -1 })),
		commentReports: commentReportRows.map((row) => ({
			commentId: row.commentId,
			reason: row.reason,
			note: row.note,
			status: row.status,
			createdAt: iso(row.createdAt)
		})),
		countFlags: flagRows.map((row) => ({
			title: title(row),
			note: row.note,
			status: row.status,
			createdAt: iso(row.createdAt)
		}))
	};
}
