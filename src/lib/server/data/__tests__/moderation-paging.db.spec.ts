import { beforeEach, describe, expect, it } from 'vitest';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import {
	commentReports,
	comments,
	communityContentReports,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listFlaggedTitles, listHeldReports } from '#lib/server/data/community-report-queue.ts';
import { getModerationCounts } from '#lib/server/data/moderation-counts.ts';
import {
	listPendingQueue,
	listRecentActions,
	listReportedQueue
} from '#lib/server/data/moderation-queue.ts';
import { QUEUE_SHAPES, decodeQueueCursor, type QueuePage } from '#lib/server/data/queue-cursor.ts';

const T0 = Date.UTC(2026, 10, 1);
let titleIds: string[];

beforeEach(async () => {
	await db
		.insert(users)
		.values([userValues('author'), userValues('rep1'), userValues('rep2'), userValues('rep3')]);
	titleIds = (
		await db
			.insert(titles)
			.values(
				Array.from({ length: 4 }, (_, i) => ({
					kind: 'movie' as const,
					title: `Film ${i}`,
					cleanTitle: `film ${i}`,
					tmdbId: 100 + i
				}))
			)
			.returning()
	).map((t) => t.id);
});

/** Inserts comments with ids `c000`, `c001`, … at the given times (ms after T0). */
async function addComments(
	status: 'pending' | 'published' | 'hidden',
	times: number[],
	from = 0
): Promise<string[]> {
	const ids = times.map((_, i) => `c${String(from + i).padStart(3, '0')}`);
	const rows = times.map((t, i) => ({
		id: ids[i],
		titleId: titleIds[0],
		userId: 'author',
		body: `Comment ${ids[i]}`,
		status,
		createdAt: new Date(T0 + t),
		updatedAt: new Date(T0 + t)
	}));
	for (const chunk of chunkForD1(rows, 15)) await db.insert(comments).values(chunk);
	return ids;
}

const openReports = (commentId: string, reporters: string[]) =>
	db
		.insert(commentReports)
		.values(reporters.map((reporterId) => ({ commentId, reporterId, reason: 'spam' as const })));

/** Every page of a list by following its cursor, so a gap or a repeat shows in the result. */
async function allPages<T>(
	list: (cursor: string | null, limit: number) => Promise<QueuePage<T>>,
	limit: number
): Promise<T[][]> {
	const pages: T[][] = [];
	let cursor: string | null = null;
	do {
		const page: QueuePage<T> = await list(cursor, limit);
		pages.push(page.items);
		cursor = page.nextCursor;
	} while (cursor && pages.length < 50);
	return pages;
}

describe('getModerationCounts', () => {
	it('counts every row, not a page of them', async () => {
		await addComments(
			'pending',
			Array.from({ length: 53 }, (_, i) => i)
		);
		await addComments('published', [100, 101, 102], 53);
		await addComments('hidden', [200], 56);
		await openReports('c000', ['rep1', 'rep2']);
		await openReports('c053', ['rep1']);
		// A closed report, a report on a hidden comment and a comment without reports count nowhere.
		await db.insert(commentReports).values({
			commentId: 'c054',
			reporterId: 'rep1',
			reason: 'spam',
			status: 'dismissed'
		});
		await openReports('c056', ['rep1']);
		await db.insert(communityContentReports).values([
			{ userId: 'rep1', titleId: titleIds[0], status: 'held', holdReason: 'busy_new_account' },
			{ userId: 'rep2', titleId: titleIds[0], status: 'held', holdReason: 'busy_new_account' },
			{ userId: 'rep3', titleId: titleIds[0], status: 'counted' }
		]);
		await db.insert(titleCountFlags).values([
			{ titleId: titleIds[0], reporterId: 'rep1' },
			{ titleId: titleIds[0], reporterId: 'rep2' },
			{ titleId: titleIds[1], reporterId: 'rep1' },
			{ titleId: titleIds[2], reporterId: 'rep1', status: 'resolved' }
		]);
		expect(await getModerationCounts()).toEqual({
			pending: 53,
			reported: 2,
			held: 2,
			flagged: 2
		});
	});

	it('is zero on an empty database', async () => {
		expect(await getModerationCounts()).toEqual({ pending: 0, reported: 0, held: 0, flagged: 0 });
	});
});

describe('listPendingQueue paging', () => {
	it('pages oldest first, with a full last page offering no further page', async () => {
		await addComments(
			'pending',
			Array.from({ length: 60 }, (_, i) => i)
		);
		const first = await listPendingQueue();
		expect(first.items).toHaveLength(50);
		expect(first.nextCursor).not.toBeNull();
		const second = await listPendingQueue(first.nextCursor);
		expect(second.items.map((i) => i.comment.id)).toEqual(
			Array.from({ length: 10 }, (_, i) => `c${String(50 + i).padStart(3, '0')}`)
		);
		expect(second.nextCursor).toBeNull();
		// Exactly a page: no cursor.
		expect((await listPendingQueue(null, 60)).nextCursor).toBeNull();
	});

	it('shows each row once across pages when many share a time', async () => {
		await addComments('pending', [0, 0, 0, 0, 0, 5, 5, 5, 9]);
		const pages = await allPages((c, l) => listPendingQueue(c, l), 2);
		expect(pages.map((p) => p.length)).toEqual([2, 2, 2, 2, 1]);
		expect(pages.flat().map((i) => i.comment.id)).toEqual([
			'c000',
			'c001',
			'c002',
			'c003',
			'c004',
			'c005',
			'c006',
			'c007',
			'c008'
		]);
	});

	it('reads a cursor it did not make as the first page', async () => {
		await addComments('pending', [0, 1, 2]);
		const page = await listPendingQueue('not-a-cursor', 2);
		expect(page.items.map((i) => i.comment.id)).toEqual(['c000', 'c001']);
	});
});

describe('listReportedQueue paging', () => {
	it('pages by open reports, then oldest, then id, with no gap or repeat across ties', async () => {
		await addComments('published', [0, 0, 1, 2, 2, 3]);
		await openReports('c000', ['rep1']);
		await openReports('c001', ['rep1', 'rep2']);
		await openReports('c002', ['rep1']);
		await openReports('c003', ['rep1', 'rep2', 'rep3']);
		await openReports('c004', ['rep1']);
		await openReports('c005', ['rep1', 'rep2']);
		const pages = await allPages((c, l) => listReportedQueue(c, l), 2);
		expect(pages.flat().map((i) => i.comment.id)).toEqual([
			'c003',
			'c001',
			'c005',
			'c000',
			'c002',
			'c004'
		]);
		expect(pages.map((p) => p.length)).toEqual([2, 2, 2]);
	});
});

describe('listHeldReports paging', () => {
	it('pages oldest first, then account and title, across ties', async () => {
		const at = new Date(T0);
		await db.insert(communityContentReports).values([
			{
				userId: 'rep2',
				titleId: titleIds[0],
				status: 'held',
				holdReason: 'busy_new_account',
				createdAt: at
			},
			{
				userId: 'rep1',
				titleId: titleIds[1],
				status: 'held',
				holdReason: 'busy_new_account',
				createdAt: at
			},
			{
				userId: 'rep1',
				titleId: titleIds[0],
				status: 'held',
				holdReason: 'busy_new_account',
				createdAt: at
			},
			{
				userId: 'rep3',
				titleId: titleIds[0],
				status: 'held',
				holdReason: 'busy_new_account',
				createdAt: new Date(T0 + 5)
			}
		]);
		const pages = await allPages((c, l) => listHeldReports(c, l), 3);
		expect(pages.map((p) => p.length)).toEqual([3, 1]);
		// Ids are random: the two titles of rep1 come in id order.
		const [first, second] = [titleIds[0], titleIds[1]].sort();
		expect(pages.flat().map((r) => `${r.account.userId}:${r.titleId}`)).toEqual([
			`rep1:${first}`,
			`rep1:${second}`,
			`rep2:${titleIds[0]}`,
			`rep3:${titleIds[0]}`
		]);
	});
});

describe('listFlaggedTitles paging', () => {
	it('pages most flagged first, then oldest flag, then title, across ties', async () => {
		const flag = (titleId: string, reporterId: string, t: number) => ({
			titleId,
			reporterId,
			createdAt: new Date(T0 + t)
		});
		await db
			.insert(titleCountFlags)
			.values([
				flag(titleIds[0], 'rep1', 5),
				flag(titleIds[1], 'rep1', 5),
				flag(titleIds[2], 'rep1', 1),
				flag(titleIds[3], 'rep1', 1),
				flag(titleIds[3], 'rep2', 2),
				flag(titleIds[0], 'rep2', 9)
			]);
		// Two flags each on titles 0 and 3; the older first flag (title 3, 1) leads; then one flag each.
		const pages = await allPages((c, l) => listFlaggedTitles(c, l), 1);
		expect(pages).toHaveLength(4);
		const sorted = [titleIds[2], titleIds[1]].sort();
		expect(pages.flat().map((f) => f.titleId)).toEqual([
			titleIds[3],
			titleIds[0],
			// One flag each: the older (title 2, at 1) before title 1 (at 5).
			titleIds[2],
			titleIds[1]
		]);
		expect(sorted).toHaveLength(2);
		expect(pages[0][0].flags).toHaveLength(2);
	});
});

describe('listRecentActions paging', () => {
	it('pages newest first, then id, across ties', async () => {
		await db.insert(moderationActions).values(
			[0, 0, 0, 3, 3].map((t, i) => ({
				id: `a${i}`,
				actorId: null,
				targetUserId: 'author',
				action: 'mute' as const,
				muteHours: 1,
				createdAt: new Date(T0 + t)
			}))
		);
		const pages = await allPages((c, l) => listRecentActions(c, l), 2);
		expect(pages.map((p) => p.length)).toEqual([2, 2, 1]);
		expect(pages.flat().map((a) => a.id)).toEqual(['a4', 'a3', 'a2', 'a1', 'a0']);
	});
});

describe('queue cursors', () => {
	it('round-trips through the URL-safe text, and refuses anything else', async () => {
		await addComments('pending', [0, 1, 2]);
		const { nextCursor } = await listPendingQueue(null, 1);
		expect(nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeQueueCursor(nextCursor, QUEUE_SHAPES.pending)).toEqual([1, 0, T0, 'c000']);
		expect(decodeQueueCursor(nextCursor, QUEUE_SHAPES.held)).toBeNull();
		expect(decodeQueueCursor('???', QUEUE_SHAPES.pending)).toBeNull();
		expect(decodeQueueCursor('x'.repeat(201), QUEUE_SHAPES.pending)).toBeNull();
		expect(decodeQueueCursor(btoa('[1.5,"a"]'), QUEUE_SHAPES.pending)).toBeNull();
		expect(decodeQueueCursor(btoa('{"a":1}'), QUEUE_SHAPES.pending)).toBeNull();
	});
});
