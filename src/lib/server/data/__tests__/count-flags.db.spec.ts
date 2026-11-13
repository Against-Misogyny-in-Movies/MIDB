import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { moderationActions, titleCountFlags } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { dismissCountFlag, flagCounts, resolveCountFlag } from '#lib/server/data/count-flags.ts';

let titleId: string;
let mod: UserRow;
let admin: UserRow;
beforeEach(async () => {
	[mod, admin] = await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator' }),
			userValues('admin', { role: 'administrator' })
		])
		.returning();
	await db.insert(users).values([userValues('r1'), userValues('r2')]);
	const [t] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = t.id;
});

async function flag(reporterId: string) {
	const [row] = await db.insert(titleCountFlags).values({ titleId, reporterId }).returning();
	return row.id;
}

describe('count flags', () => {
	it('tallies flags by status', async () => {
		expect(await flagCounts(titleId)).toEqual({ open: 0, resolved: 0, dismissed: 0 });
		const a = await flag('r1');
		await flag('r2');
		await resolveCountFlag(a, mod);
		expect(await flagCounts(titleId)).toEqual({ open: 1, resolved: 1, dismissed: 0 });
	});

	it('resolves and dismisses an open flag once, recording the moderator', async () => {
		const a = await flag('r1');
		const b = await flag('r2');
		expect(await resolveCountFlag(a, mod)).toEqual({ ok: true });
		expect(await dismissCountFlag(b, mod)).toEqual({ ok: true });
		const rows = await db.select().from(titleCountFlags);
		expect(rows.map((r) => [r.status, r.resolvedBy]).sort()).toEqual([
			['dismissed', 'mod'],
			['resolved', 'mod']
		]);
	});

	it('does not touch a flag that is already closed or missing', async () => {
		const a = await flag('r1');
		await dismissCountFlag(a, mod);
		expect(await resolveCountFlag(a, mod)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await dismissCountFlag('nope', mod)).toEqual({ ok: false, reason: 'not-found' });
		expect((await flagCounts(titleId)).dismissed).toBe(1);
	});

	it('refuses a moderator closing their own flag, changing nothing', async () => {
		const own = await flag('mod');
		const refused = { ok: false, reason: 'own-flag' };
		expect(await resolveCountFlag(own, mod)).toEqual(refused);
		expect(await dismissCountFlag(own, mod)).toEqual(refused);
		expect(await flagCounts(titleId)).toEqual({ open: 1, resolved: 0, dismissed: 0 });
		expect(await db.select().from(moderationActions)).toHaveLength(0);
	});

	it('lets a moderator close a peer’s or an administrator’s flag', async () => {
		await db.insert(users).values(userValues('mod2', { role: 'moderator' }));
		const peer = await flag('mod2');
		const boss = await flag('admin');
		expect(await resolveCountFlag(peer, mod)).toEqual({ ok: true });
		expect(await dismissCountFlag(boss, mod)).toEqual({ ok: true });
	});

	it('lets an administrator close their own flag and a moderator’s', async () => {
		const own = await flag('admin');
		const byMod = await flag('mod');
		expect(await resolveCountFlag(own, admin)).toEqual({ ok: true });
		expect(await dismissCountFlag(byMod, admin)).toEqual({ ok: true });
	});
});
