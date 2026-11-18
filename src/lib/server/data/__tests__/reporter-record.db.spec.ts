import { beforeEach, describe, expect, it } from 'vitest';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { listPendingQueue } from '../moderation-queue.ts';
import { reporterRecords } from '../reporter-record.ts';

let titleId: string;

beforeEach(async () => {
	await db.insert(users).values([userValues('author'), userValues('rep'), userValues('rep2')]);
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

/** A comment of `author` in `status`, reported by `reporter` with a report in `reportStatus`. */
async function report(
	id: string,
	status: (typeof comments.$inferInsert)['status'],
	reportStatus: (typeof commentReports.$inferInsert)['status'],
	reporter = 'rep'
) {
	await db.insert(comments).values({ id, titleId, userId: 'author', body: id, status });
	await db
		.insert(commentReports)
		.values({ commentId: id, reporterId: reporter, reason: 'spam', status: reportStatus });
}

describe('reporterRecords', () => {
	it('counts a resolved report as upheld and a dismissed one as dismissed', async () => {
		await report('c1', 'hidden', 'resolved');
		await report('c2', 'published', 'dismissed');
		await report('c3', 'rejected', 'resolved');
		expect((await reporterRecords(['rep'])).get('rep')).toEqual({
			total: 3,
			upheld: 2,
			dismissed: 1
		});
	});

	it('counts an open report on a hidden or rejected comment as upheld, and an open one elsewhere as neither', async () => {
		await report('c1', 'hidden', 'open');
		await report('c2', 'rejected', 'open');
		await report('c3', 'pending', 'open');
		await report('c4', 'published', 'open');
		await report('c5', 'deleted', 'open');
		expect((await reporterRecords(['rep'])).get('rep')).toEqual({
			total: 5,
			upheld: 2,
			dismissed: 0
		});
	});

	it('never counts a dismissed report as upheld, even on a comment hidden since', async () => {
		await report('c1', 'hidden', 'dismissed');
		expect((await reporterRecords(['rep'])).get('rep')).toEqual({
			total: 1,
			upheld: 0,
			dismissed: 1
		});
	});

	it('keeps each reporter’s record apart, skips accounts without reports and ignores null ids', async () => {
		await report('c1', 'hidden', 'resolved', 'rep');
		await report('c2', 'published', 'dismissed', 'rep2');
		const records = await reporterRecords(['rep', 'rep2', 'author', null]);
		expect(records.get('rep')).toEqual({ total: 1, upheld: 1, dismissed: 0 });
		expect(records.get('rep2')).toEqual({ total: 1, upheld: 0, dismissed: 1 });
		expect(records.has('author')).toBe(false);
		expect((await reporterRecords([])).size).toBe(0);
	});

	it('answers for more reporters than one statement binds', async () => {
		const many = Array.from({ length: 130 }, (_, i) => `r${i}`);
		await db.insert(comments).values({ id: 'c1', titleId, userId: 'author', body: 'x' });
		for (const chunk of chunkForD1(many, 8)) {
			await db.insert(users).values(chunk.map((id) => userValues(id)));
		}
		for (const chunk of chunkForD1(many, 8)) {
			await db
				.insert(commentReports)
				.values(chunk.map((id) => ({ commentId: 'c1', reporterId: id, reason: 'spam' as const })));
		}
		expect((await reporterRecords(many)).size).toBe(130);
	});
});

describe('the queue shows each reporter’s record', () => {
	it('names the reporter’s id and record on every open report of an item', async () => {
		await report('old1', 'hidden', 'resolved');
		await report('old2', 'published', 'dismissed');
		await db
			.insert(comments)
			.values({ id: 'now', titleId, userId: 'author', body: 'now', status: 'pending' });
		await db
			.insert(commentReports)
			.values({ commentId: 'now', reporterId: 'rep', reason: 'hate', status: 'open' });
		const [item] = (await listPendingQueue()).items;
		expect(item.reports).toEqual([
			expect.objectContaining({
				reporterId: 'rep',
				record: { total: 3, upheld: 1, dismissed: 1 }
			})
		]);
	});
});
