import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listPendingQueue, listReportedQueue } from '#lib/server/data/moderation-queue.ts';
import type { QueuePage } from '#lib/server/data/queue-cursor.ts';

const T0 = Date.UTC(2026, 10, 1);
let titleId: string;

beforeEach(async () => {
	await db.insert(users).values(['author', 'r1', 'r2', 'r3'].map((id) => userValues(id)));
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

type Spec = {
	id: string;
	/** The stored `ai_verdict`: an object is serialised; a string is stored as is. */
	verdict?: Record<string, unknown> | string | null;
	status?: 'pending' | 'published';
	/** Minutes after T0. */
	at?: number;
	reports?: number;
};

async function seed(specs: Spec[]) {
	const rows = specs.map((s) => ({
		id: s.id,
		titleId,
		userId: 'author',
		body: `Body ${s.id}`,
		status: s.status ?? 'pending',
		aiVerdict:
			s.verdict === undefined || s.verdict === null
				? null
				: typeof s.verdict === 'string'
					? s.verdict
					: JSON.stringify(s.verdict),
		createdAt: new Date(T0 + (s.at ?? 0) * 60_000),
		updatedAt: new Date(T0 + (s.at ?? 0) * 60_000)
	}));
	for (const chunk of chunkForD1(rows, 15)) await db.insert(comments).values(chunk);
	const reporters = ['r1', 'r2', 'r3'];
	const reports = specs.flatMap((s) =>
		reporters
			.slice(0, s.reports ?? 0)
			.map((reporterId) => ({ commentId: s.id, reporterId, reason: 'spam' as const }))
	);
	for (const chunk of chunkForD1(reports, 4)) await db.insert(commentReports).values(chunk);
}

const ids = (page: QueuePage<{ comment: { id: string } }>) => page.items.map((i) => i.comment.id);

async function everyPage(
	list: (cursor: string | null, limit: number) => Promise<QueuePage<{ comment: { id: string } }>>,
	limit: number
): Promise<string[][]> {
	const pages: string[][] = [];
	let cursor: string | null = null;
	do {
		const page: QueuePage<{ comment: { id: string } }> = await list(cursor, limit);
		pages.push(ids(page));
		cursor = page.nextCursor;
	} while (cursor && pages.length < 30);
	return pages;
}

describe('the priority order of Pending', () => {
	it('puts the highest severity first, whatever the age or the reports', async () => {
		await seed([
			{ id: 'sev1', verdict: { severity: 1 }, at: 0, reports: 3 },
			{ id: 'sev3', verdict: { severity: 3 }, at: 50 },
			{ id: 'sev2', verdict: { severity: 2 }, at: 10 }
		]);
		expect(ids(await listPendingQueue())).toEqual(['sev3', 'sev2', 'sev1']);
	});

	it('ranks a missing or failed verdict below severity 1 and above one that found nothing', async () => {
		await seed([
			{ id: 'none', verdict: { severity: 0, categories: [] }, at: 0 },
			{ id: 'missing', verdict: null, at: 1 },
			{ id: 'failed', verdict: { failure: 'ai-timeout' }, at: 2 },
			{ id: 'garbled', verdict: '[1, 2]', at: 3 },
			{ id: 'texty', verdict: { severity: 'high' }, at: 4 },
			{ id: 'sev1', verdict: { severity: 1 }, at: 5 }
		]);
		expect(ids(await listPendingQueue())).toEqual([
			'sev1',
			'missing',
			'failed',
			'garbled',
			'texty',
			'none'
		]);
	});

	it('breaks a severity tie by open reports, then the oldest, then the id', async () => {
		await seed([
			{ id: 'c-old', verdict: { severity: 2 }, at: 0 },
			{ id: 'c-new', verdict: { severity: 2 }, at: 30 },
			{ id: 'c-reported', verdict: { severity: 2 }, at: 60, reports: 2 },
			{ id: 'c-twin-b', verdict: { severity: 2 }, at: 15 },
			{ id: 'c-twin-a', verdict: { severity: 2 }, at: 15 }
		]);
		expect(ids(await listPendingQueue())).toEqual([
			'c-reported',
			'c-old',
			'c-twin-a',
			'c-twin-b',
			'c-new'
		]);
	});

	it('shows the severity and the reports behind a row’s place', async () => {
		await seed([{ id: 'c1', verdict: { severity: 2, categories: ['hate'] }, reports: 2 }]);
		const [item] = (await listPendingQueue()).items;
		expect(item).toMatchObject({ severity: 2, aiCategories: ['hate'] });
		expect(item.reports).toHaveLength(2);
	});

	it('leaves a comment that is not pending out', async () => {
		await seed([
			{ id: 'p', verdict: { severity: 1 } },
			{ id: 'q', status: 'published' }
		]);
		expect(ids(await listPendingQueue())).toEqual(['p']);
	});
});

describe('the priority order of Reported', () => {
	it('uses the same order over pending and published comments with open reports', async () => {
		await seed([
			{ id: 'a', status: 'published', verdict: { severity: 0 }, reports: 3, at: 0 },
			{ id: 'b', status: 'published', verdict: { severity: 1 }, reports: 1, at: 5 },
			{ id: 'c', status: 'pending', verdict: { severity: 1 }, reports: 2, at: 9 },
			{ id: 'd', status: 'published', verdict: null, reports: 1, at: 1 },
			{ id: 'e', status: 'published', verdict: { severity: 3 }, at: 2 }
		]);
		// The severity leads; 'e' has no open report and is not listed.
		expect(ids(await listReportedQueue())).toEqual(['c', 'b', 'd', 'a']);
	});
});

describe('paging in priority order', () => {
	const mix: Spec[] = [
		{ id: 'k01', verdict: { severity: 3 }, at: 0 },
		{ id: 'k02', verdict: { severity: 3 }, at: 0 },
		{ id: 'k03', verdict: { severity: 3 }, at: 0, reports: 1 },
		{ id: 'k04', verdict: { severity: 2 }, at: 0, reports: 1 },
		{ id: 'k05', verdict: { severity: 2 }, at: 0, reports: 1 },
		{ id: 'k06', verdict: null, at: 0, reports: 2 },
		{ id: 'k07', verdict: null, at: 0, reports: 2 },
		{ id: 'k08', verdict: { severity: 0 }, at: 0, reports: 3 },
		{ id: 'k09', verdict: { severity: 0 }, at: 0, reports: 3 }
	];
	const expected = ['k03', 'k01', 'k02', 'k04', 'k05', 'k06', 'k07', 'k08', 'k09'];

	it.each([1, 2, 4])('shows every row once, in order, across pages of %i', async (limit) => {
		await seed(mix);
		const pages = await everyPage((c, l) => listPendingQueue(c, l), limit);
		expect(pages.flat()).toEqual(expected);
		expect(pages.every((p) => p.length <= limit)).toBe(true);
	});

	it('pages Reported across ties the same way', async () => {
		await seed(mix.map((s) => ({ ...s, status: 'published' as const })));
		const reported = expected.filter((id) => id !== 'k01' && id !== 'k02');
		const pages = await everyPage((c, l) => listReportedQueue(c, l), 2);
		expect(pages.flat()).toEqual(reported);
	});

	it('resumes after a row that is acted on between pages', async () => {
		await seed(mix);
		const first = await listPendingQueue(null, 3);
		await db.update(comments).set({ status: 'hidden' }).where(eq(comments.id, 'k03'));
		const second = await listPendingQueue(first.nextCursor, 3);
		expect(ids(second)).toEqual(['k04', 'k05', 'k06']);
	});

	it('reads a cursor of the old shape as the first page', async () => {
		await seed(mix);
		const old = btoa(JSON.stringify([T0, 'k01'])).replaceAll('=', '');
		expect(ids(await listPendingQueue(old, 2))).toEqual(['k03', 'k01']);
	});
});
