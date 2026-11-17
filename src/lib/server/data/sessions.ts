import { and, count, desc, eq, gt, ne } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { sessions } from '#db/schema/auth.ts';

/** A live session as the account's list needs it. The token and the IP address are never read. */
export interface LiveSession {
	id: string;
	userAgent: string | null;
	createdAt: Date;
}

/** How many sessions of the account have not expired: the rows the Sessions card reserves. */
export async function countLiveSessions(userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(sessions)
		.where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));
	return row?.n ?? 0;
}

/** The account's unexpired sessions, newest first. */
export async function listLiveSessions(userId: string): Promise<LiveSession[]> {
	return db
		.select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt })
		.from(sessions)
		.where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
		.orderBy(desc(sessions.createdAt), sessions.id);
}

/** Ends one session of the account, never another account's. Ending one that is gone is not an error. */
export async function endSession(userId: string, sessionId: string): Promise<void> {
	await db.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)));
}

/** Ends every session of the account except `keepId`. */
export async function endOtherSessions(userId: string, keepId: string): Promise<void> {
	await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepId)));
}
