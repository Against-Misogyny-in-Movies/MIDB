import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { accountNotes, moderationActions } from '#db/schema/community.ts';
import { NOTE_MAX } from '#lib/media/utils/comments.ts';
import { runBatch } from './comment-status.ts';
import { logRow } from './moderation-log.ts';
import type { ModerationResult } from './moderation-actions.ts';
import { targetAllowed } from './moderation-target.ts';
import type { UserRow } from './user-queries.ts';

/** Notes an account's page lists; it says when there are more. */
export const NOTES_SHOWN = 50;

export type AccountNote = {
	id: string;
	body: string;
	createdAt: string;
	/** The staff member's username; null once their account is gone. */
	author: string | null;
	authorId: string | null;
};

/** The account's staff notes, newest first, and how many it has in all. */
export async function listAccountNotes(
	userId: string
): Promise<{ notes: AccountNote[]; total: number }> {
	const [rows, [count]] = await Promise.all([
		db
			.select({
				id: accountNotes.id,
				body: accountNotes.body,
				createdAt: accountNotes.createdAt,
				author: users.username,
				authorId: accountNotes.authorId
			})
			.from(accountNotes)
			.leftJoin(users, eq(accountNotes.authorId, users.id))
			.where(eq(accountNotes.userId, userId))
			.orderBy(desc(accountNotes.createdAt), desc(accountNotes.id))
			.limit(NOTES_SHOWN),
		db
			.select({ n: sql<number>`count(*)` })
			.from(accountNotes)
			.where(eq(accountNotes.userId, userId))
	]);
	return {
		notes: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
		total: count.n
	};
}

/**
 * Adds a staff note to an account and logs it as `note`, in one batch. The log row does not carry the
 * text, so it stays out of the log's readers and of any export of the log. The text is 1 to
 * `NOTE_MAX` characters after trimming (`invalid` otherwise), and the actor needs the authority
 * `canActOn` gives over the account (`forbidden-target`); a deleted account is `not-found`. Both
 * statements apply only while the account is not deleted, so a deletion between the read and the
 * batch writes neither.
 */
export async function addAccountNote(
	actor: UserRow,
	targetId: string,
	body: string
): Promise<ModerationResult | { ok: false; reason: 'invalid' }> {
	const text = body.trim();
	if (text.length < 1 || text.length > NOTE_MAX) return { ok: false, reason: 'invalid' };
	const target = await targetAllowed(actor, targetId);
	if (typeof target === 'string') return { ok: false, reason: target };
	const live = and(eq(users.id, targetId), isNull(users.deletedAt));
	const now = sql<number>`${Date.now()}`;
	const results = await runBatch([
		db
			.insert(accountNotes)
			.select(
				db
					.select({
						id: sql<string>`${crypto.randomUUID()}`.as('id'),
						userId: users.id,
						authorId: sql<string>`${actor.id}`.as('authorId'),
						body: sql<string>`${text}`.as('body'),
						createdAt: now.as('createdAt'),
						updatedAt: now.as('updatedAt')
					})
					.from(users)
					.where(live)
			)
			.returning({ id: accountNotes.id }),
		db.insert(moderationActions).select(
			db
				.select(logRow(actor.id, 'note', { userId: users.id }))
				.from(users)
				.where(live)
		)
	]);
	const added = results[0];
	return Array.isArray(added) && added.length > 0
		? { ok: true, title: null }
		: { ok: false, reason: 'not-found' };
}
