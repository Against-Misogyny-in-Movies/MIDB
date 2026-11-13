import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentAiLabels, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listScanItems, saveScanLabels } from '#lib/server/data/comment-ai-labels.ts';
import type { ScanResult } from '#lib/server/moderation/scan.ts';

const result = (id: string, over: Partial<ScanResult> = {}): ScanResult => ({
	id,
	match: true,
	categories: ['trolling'],
	severity: 2,
	reason: 'Bait.',
	model: 'claude-haiku-5-5',
	...over
});

beforeEach(async () => {
	await db.insert(users).values(userValues('ann'));
	await db.insert(users).values(userValues('staff'));
	const [t] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning({ id: titles.id });
	for (let i = 0; i < 30; i++) {
		await db
			.insert(comments)
			.values({ id: `c${i}`, titleId: t.id, userId: 'ann', body: `b${i}`, status: 'published' });
	}
});

describe('saveScanLabels', () => {
	it('writes one row per result with the concern, the staff id and the categories as JSON', async () => {
		await saveScanLabels('staff', 'trolling', [
			result('c0'),
			result('c1', { match: false, categories: [], severity: 0 })
		]);
		const rows = await db.select().from(commentAiLabels).orderBy(commentAiLabels.commentId);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			commentId: 'c0',
			concern: 'trolling',
			matched: true,
			categories: '["trolling"]',
			severity: 2,
			reason: 'Bait.',
			model: 'claude-haiku-5-5',
			scannedBy: 'staff'
		});
		expect(rows[0].id).toBeTruthy();
		expect(rows[1]).toMatchObject({ matched: false, categories: '[]', severity: 0 });
	});

	it('writes more results than one statement binds, all in one batch', async () => {
		await saveScanLabels(
			'staff',
			'c',
			Array.from({ length: 30 }, (_, i) => result(`c${i}`))
		);
		expect(await db.select().from(commentAiLabels)).toHaveLength(30);
	});

	it('appends on a second scan and keeps the first', async () => {
		await saveScanLabels('staff', 'first', [result('c0')]);
		await saveScanLabels('staff', 'second', [result('c0', { match: false })]);
		const rows = await db.select().from(commentAiLabels).where(eq(commentAiLabels.commentId, 'c0'));
		expect(rows.map((r) => r.concern).sort()).toEqual(['first', 'second']);
	});

	it.each(['', '   ', 'x'.repeat(201)])(
		'refuses the concern %j before writing',
		async (concern) => {
			await expect(saveScanLabels('staff', concern, [result('c0')])).rejects.toThrow();
			expect(await db.select().from(commentAiLabels)).toHaveLength(0);
		}
	);

	it('stores the concern trimmed', async () => {
		await saveScanLabels('staff', '  trolling ', [result('c0')]);
		expect((await db.select().from(commentAiLabels))[0].concern).toBe('trolling');
	});

	it('writes nothing for no results', async () => {
		await saveScanLabels('staff', 'c', []);
		expect(await db.select().from(commentAiLabels)).toHaveLength(0);
	});

	it('saves nothing when one row breaks a constraint', async () => {
		await expect(
			saveScanLabels(
				'staff',
				'c',
				Array.from({ length: 12 }, (_, i) => result(`c${i}`, i === 11 ? { severity: 9 } : {}))
			)
		).rejects.toThrow();
		expect(await db.select().from(commentAiLabels)).toHaveLength(0);
	});
});

describe('listScanItems', () => {
	it('returns the found comments in the order asked, with their title, and skips deleted and unknown ids', async () => {
		await db.update(comments).set({ status: 'deleted' }).where(eq(comments.id, 'c2'));
		expect(await listScanItems(['c3', 'c2', 'gone', 'c1'])).toEqual([
			{ id: 'c3', body: 'b3', titleName: 'Alien', kind: 'movie' },
			{ id: 'c1', body: 'b1', titleName: 'Alien', kind: 'movie' }
		]);
	});

	it('reads a full page of ids across D1 statements', async () => {
		const ids = Array.from({ length: 30 }, (_, i) => `c${i}`);
		expect((await listScanItems(ids)).map((item) => item.id)).toEqual(ids);
		expect(await listScanItems([])).toEqual([]);
	});
});
