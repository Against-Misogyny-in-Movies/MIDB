import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titleCountFlags } from '#db/schema/community.ts';
import { canCloseFlag } from '#lib/media/utils/canActOn.ts';
import { logWhere, runLogged } from './moderation-log.ts';
import { flagClosedByAdministrator, flagsClosedByAdministrator } from './moderation-target.ts';
import type { UserRow } from './user-queries.ts';

/**
 * How a close or a re-open ends: `own-flag` when a moderator closes or re-opens their own flag or
 * an administrator's, `admin-acted` when a moderator re-opens a flag an administrator closed.
 */
export type FlagCloseResult =
	| { ok: true }
	| { ok: false; reason: 'not-found' | 'invalid-state' | 'own-flag' | 'admin-acted' };

/** The "counts look wrong" flags on a title, by status. */
export async function flagCounts(
	titleId: string
): Promise<{ open: number; resolved: number; dismissed: number }> {
	const rows = await db
		.select({ status: titleCountFlags.status, n: sql<number>`count(*)` })
		.from(titleCountFlags)
		.where(eq(titleCountFlags.titleId, titleId))
		.groupBy(titleCountFlags.status);
	const out = { open: 0, resolved: 0, dismissed: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

type FlagRow = { id: string; titleId: string; reporterId: string; reporterRole: string };

const closedByAdministrator = async (flag: FlagRow) =>
	(await flagsClosedByAdministrator([flag])).size > 0;

async function readFlag(flagId: string): Promise<FlagRow | undefined> {
	const [flag] = await db
		.select({
			id: titleCountFlags.id,
			titleId: titleCountFlags.titleId,
			reporterId: users.id,
			reporterRole: users.role
		})
		.from(titleCountFlags)
		.innerJoin(users, eq(titleCountFlags.reporterId, users.id))
		.where(eq(titleCountFlags.id, flagId));
	return flag;
}

/**
 * Moves an open flag to `status` and logs it in the same batch, the log row only while the flag
 * is still open. The log row names the flag's reporter as its target account, so the log can
 * offer to re-open that flag (`reopenCountFlag`). `canCloseFlag` decides who may: a moderator
 * cannot close their own flag or an administrator's, and gets `own-flag`. `invalid-state` when
 * the flag is not open, `not-found` when it does not exist. Counts do not change, so nothing is
 * purged.
 */
async function closeFlag(
	flagId: string,
	actor: UserRow,
	status: 'resolved' | 'dismissed'
): Promise<FlagCloseResult> {
	const flag = await readFlag(flagId);
	if (!flag) return { ok: false, reason: 'not-found' };
	if (!canCloseFlag(actor, { id: flag.reporterId, role: flag.reporterRole })) {
		return { ok: false, reason: 'own-flag' };
	}
	const open = and(eq(titleCountFlags.id, flagId), eq(titleCountFlags.status, 'open'));
	const applied = await runLogged(
		logWhere(
			actor.id,
			status === 'resolved' ? 'resolve_count_flag' : 'dismiss_count_flag',
			{ titleId: titleCountFlags.titleId, userId: titleCountFlags.reporterId },
			titleCountFlags,
			open
		),
		db
			.update(titleCountFlags)
			.set({ status, resolvedBy: actor.id })
			.where(open)
			.returning({ id: titleCountFlags.id })
	);
	return applied ? { ok: true } : { ok: false, reason: 'invalid-state' };
}

/**
 * Re-opens a resolved or dismissed flag and logs it in the same batch, with the authority of
 * `canCloseFlag` (`own-flag` otherwise). A moderator cannot re-open a flag whose latest close an
 * administrator took (`admin-acted`: read before the batch, and guarded inside it by
 * `flagClosedByAdministrator`). `invalid-state` when the flag is already open, and `not-found`
 * when it does not exist. Counts do not change, so nothing is purged.
 */
export async function reopenCountFlag(flagId: string, actor: UserRow): Promise<FlagCloseResult> {
	const flag = await readFlag(flagId);
	if (!flag) return { ok: false, reason: 'not-found' };
	if (!canCloseFlag(actor, { id: flag.reporterId, role: flag.reporterRole })) {
		return { ok: false, reason: 'own-flag' };
	}
	const bound = actor.role !== 'administrator';
	if (bound && (await closedByAdministrator(flag))) return { ok: false, reason: 'admin-acted' };
	const closed = and(
		eq(titleCountFlags.id, flagId),
		ne(titleCountFlags.status, 'open'),
		bound ? sql`NOT ${flagClosedByAdministrator()}` : undefined
	);
	const applied = await runLogged(
		logWhere(
			actor.id,
			'reopen_flag',
			{ titleId: titleCountFlags.titleId, userId: titleCountFlags.reporterId },
			titleCountFlags,
			closed
		),
		db
			.update(titleCountFlags)
			.set({ status: 'open', resolvedBy: null })
			.where(closed)
			.returning({ id: titleCountFlags.id })
	);
	if (applied) return { ok: true };
	return {
		ok: false,
		reason: bound && (await closedByAdministrator(flag)) ? 'admin-acted' : 'invalid-state'
	};
}

/** A moderator acted on the counts the flag pointed at. */
export const resolveCountFlag = (flagId: string, actor: UserRow) =>
	closeFlag(flagId, actor, 'resolved');

/** A moderator found the counts fine. */
export const dismissCountFlag = (flagId: string, actor: UserRow) =>
	closeFlag(flagId, actor, 'dismissed');

/**
 * Stores a reader's "counts look wrong" flag on a title: one per account per title. A second
 * call replaces the note and re-opens a flag a moderator had closed, so the reader can raise it
 * again.
 */
export async function upsertCountFlag(
	titleId: string,
	reporterId: string,
	note: string | null
): Promise<void> {
	await db
		.insert(titleCountFlags)
		.values({ titleId, reporterId, note })
		.onConflictDoUpdate({
			target: [titleCountFlags.titleId, titleCountFlags.reporterId],
			set: { note, status: 'open', resolvedBy: null, updatedAt: new Date() }
		});
}
