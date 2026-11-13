import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentAiLabels, commentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listModerationTable } from '#lib/server/data/moderation-table.ts';
import { TABLE_PAGE_SIZE, TableFilters } from '#lib/media/utils/moderationFilters.ts';

const filters = (over: Partial<TableFilters> = {}) => TableFilters.parse(over);
const ids = async (over: Partial<TableFilters> = {}) =>
	(await listModerationTable(filters(over))).rows.map((r) => r.comment.id);

const verdict = (categories: string[], severity: number) =>
	JSON.stringify({ decision: 'review', categories, severity, reason: 'r', model: 'm' });

const at = (iso: string) => new Date(iso);

let titleId: string;

async function add(id: string, over: Partial<typeof comments.$inferInsert> = {}): Promise<void> {
	await db.insert(comments).values({
		id,
		titleId,
		userId: 'ann',
		body: `body ${id}`,
		status: 'published',
		createdAt: at('2026-11-01T12:00:00Z'),
		...over
	});
}

beforeEach(async () => {
	await db.insert(users).values(userValues('ann', { username: 'ann' }));
	await db.insert(users).values(userValues('bob', { username: 'bob' }));
	await db.insert(users).values(userValues('rep1'));
	await db.insert(users).values(userValues('rep2'));
	const [t] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = t.id;
	await db.insert(titles).values({ kind: 'movie', title: 'Heat', cleanTitle: 'heat', tmdbId: 949 });
});

describe('listModerationTable', () => {
	it('lists comments in every status, deleted included, newest first', async () => {
		await add('a', { status: 'pending', createdAt: at('2026-11-01T00:00:00Z') });
		await add('b', { status: 'deleted', createdAt: at('2026-11-02T00:00:00Z') });
		await add('c', { status: 'rejected', createdAt: at('2026-11-03T00:00:00Z') });
		const table = await listModerationTable(filters());
		expect(table.rows.map((r) => r.comment.id)).toEqual(['c', 'b', 'a']);
		expect(table).toMatchObject({ total: 3, page: 1, pageSize: TABLE_PAGE_SIZE });
		expect(table.rows[0]).toMatchObject({
			author: { id: 'ann' },
			title: { name: 'Alien' },
			latestLabel: null,
			severity: null,
			aiFailure: null
		});
	});

	it('filters by text, status, source, title, author and date, matching literally', async () => {
		await add('a', { body: 'Ordinary 100% talk', status: 'pending' });
		await add('b', { body: 'Another', moderationSource: 'ai', userId: 'bob' });
		await add('c', { body: 'Other_one', createdAt: at('2026-10-20T10:00:00Z') });
		expect(await ids({ q: '100%' })).toEqual(['a']);
		expect(await ids({ q: 'other_' })).toEqual(['c']);
		expect(await ids({ q: 'zzz' })).toEqual([]);
		expect(await ids({ status: ['pending'] })).toEqual(['a']);
		expect((await ids({ status: ['pending', 'published'] })).sort()).toEqual(['a', 'b', 'c']);
		expect(await ids({ source: 'ai' })).toEqual(['b']);
		expect(await ids({ author: 'BO' })).toEqual(['b']);
		expect(await ids({ title: 'alien' })).toHaveLength(3);
		expect(await ids({ title: 'heat' })).toEqual([]);
		expect(await ids({ from: '2026-11-01' })).toEqual(['b', 'a']);
		expect(await ids({ to: '2026-10-20' })).toEqual(['c']);
		expect(await ids({ from: '2026-10-20', to: '2026-10-20' })).toEqual(['c']);
	});

	it('filters by open reports and sorts by their number', async () => {
		await add('a', { createdAt: at('2026-11-01T00:00:00Z') });
		await add('b', { createdAt: at('2026-11-02T00:00:00Z') });
		await add('c', { createdAt: at('2026-11-03T00:00:00Z') });
		await db.insert(commentReports).values([
			{ commentId: 'a', reporterId: 'rep1', reason: 'spam' },
			{ commentId: 'a', reporterId: 'rep2', reason: 'hate' },
			{ commentId: 'b', reporterId: 'rep1', reason: 'spam' },
			{ commentId: 'c', reporterId: 'rep1', reason: 'spam', status: 'dismissed' }
		]);
		expect(await ids({ reported: true })).toEqual(['b', 'a']);
		expect(await ids({ sort: 'reports' })).toEqual(['a', 'b', 'c']);
		const rows = (await listModerationTable(filters({ reported: true }))).rows;
		expect(rows.find((r) => r.comment.id === 'a')?.reports).toHaveLength(2);
	});

	it('filters on verdict categories and severity, and sorts by severity', async () => {
		await add('a', { aiVerdict: verdict(['trolling'], 1), createdAt: at('2026-11-01T00:00:00Z') });
		await add('b', {
			aiVerdict: verdict(['violence', 'hate'], 3),
			createdAt: at('2026-11-02T00:00:00Z')
		});
		await add('c', {
			aiVerdict: JSON.stringify({ failure: 'ai-timeout' }),
			createdAt: at('2026-11-03T00:00:00Z')
		});
		await add('d', { createdAt: at('2026-11-04T00:00:00Z') });
		expect(await ids({ categories: ['violence'] })).toEqual(['b']);
		expect((await ids({ categories: ['violence', 'trolling'] })).sort()).toEqual(['a', 'b']);
		expect(await ids({ categories: ['disparagement'] })).toEqual([]);
		expect(await ids({ minSeverity: 2 })).toEqual(['b']);
		expect((await ids({ minSeverity: 1 })).sort()).toEqual(['a', 'b']);
		// A comment with no verdict, or a failed one, sorts after every severity.
		expect(await ids({ sort: 'severity' })).toEqual(['b', 'a', 'd', 'c']);
		const rows = (await listModerationTable(filters())).rows;
		expect(rows.find((r) => r.comment.id === 'c')).toMatchObject({
			severity: null,
			aiFailure: 'ai-timeout'
		});
		expect(rows.find((r) => r.comment.id === 'b')).toMatchObject({
			severity: 3,
			aiCategories: ['violence', 'hate']
		});
	});

	it('matches a category only through the newest scan label, as the scan cell shows it', async () => {
		await add('a', { aiVerdict: verdict([], 0) });
		await add('b');
		await add('c');
		await add('x', { aiVerdict: verdict(['trolling'], 1) });
		const label = (commentId: string, day: string, matched: boolean, categories: string[]) => ({
			commentId,
			concern: `${commentId}-${day}`,
			matched,
			categories: JSON.stringify(categories),
			severity: matched ? 2 : 0,
			reason: 'r',
			model: 'm',
			createdAt: at(`2026-11-${day}T00:00:00Z`)
		});
		await db
			.insert(commentAiLabels)
			.values([
				label('a', '05', true, ['violence']),
				label('b', '05', false, ['violence']),
				label('c', '05', true, ['violence'])
			]);
		// Scanned for "violence" once: a and c match through the scan; b did not match.
		expect((await ids({ categories: ['violence'] })).sort()).toEqual(['a', 'c']);
		// A second scan that does not match hides the first scan's categories.
		await db.insert(commentAiLabels).values(label('a', '06', false, []));
		expect(await ids({ categories: ['violence'] })).toEqual(['c']);
		// The verdict's own categories still match.
		expect(await ids({ categories: ['trolling'] })).toEqual(['x']);
		const rows = (await listModerationTable(filters())).rows;
		expect(rows.find((r) => r.comment.id === 'a')?.latestLabel).toMatchObject({
			concern: 'a-06',
			matched: false,
			categories: []
		});
		expect(rows.find((r) => r.comment.id === 'c')?.latestLabel).toMatchObject({ matched: true });
		expect(rows.find((r) => r.comment.id === 'x')?.latestLabel).toBeNull();
	});

	it('sorts oldest first and pages by offset', async () => {
		const n = TABLE_PAGE_SIZE + 5;
		for (let i = 0; i < n; i++) {
			await add(`c${String(i).padStart(3, '0')}`, {
				createdAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000)
			});
		}
		const first = await listModerationTable(filters({ sort: 'oldest' }));
		expect(first.rows).toHaveLength(TABLE_PAGE_SIZE);
		expect(first.total).toBe(n);
		expect(first.rows[0].comment.id).toBe('c000');
		const second = await listModerationTable(filters({ sort: 'oldest', page: 2 }));
		expect(second.rows.map((r) => r.comment.id)).toEqual(['c050', 'c051', 'c052', 'c053', 'c054']);
		const past = await listModerationTable(filters({ page: 3 }));
		expect(past).toMatchObject({ rows: [], total: n, page: 3 });
	});
});
