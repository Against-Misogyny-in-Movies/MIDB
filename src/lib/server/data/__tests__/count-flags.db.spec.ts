import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { titleCountFlags } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { dismissCountFlag, flagCounts, resolveCountFlag } from '#lib/server/data/count-flags.ts';

let titleId: string;
beforeEach(async () => {
	await db.insert(users).values([userValues('r1'), userValues('r2'), userValues('mod')]);
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
		await resolveCountFlag(a, 'mod');
		expect(await flagCounts(titleId)).toEqual({ open: 1, resolved: 1, dismissed: 0 });
	});

	it('resolves and dismisses an open flag once, recording the moderator', async () => {
		const a = await flag('r1');
		const b = await flag('r2');
		expect(await resolveCountFlag(a, 'mod')).toBe(true);
		expect(await dismissCountFlag(b, 'mod')).toBe(true);
		const rows = await db.select().from(titleCountFlags);
		expect(rows.map((r) => [r.status, r.resolvedBy]).sort()).toEqual([
			['dismissed', 'mod'],
			['resolved', 'mod']
		]);
	});

	it('does not touch a flag that is already closed or missing', async () => {
		const a = await flag('r1');
		await dismissCountFlag(a, 'mod');
		expect(await resolveCountFlag(a, 'mod')).toBe(false);
		expect(await dismissCountFlag('nope', 'mod')).toBe(false);
		expect((await flagCounts(titleId)).dismissed).toBe(1);
	});
});
