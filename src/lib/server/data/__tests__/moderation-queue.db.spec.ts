import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { createComment } from '#lib/server/data/comment-queries.ts';
import { listReportedQueue } from '#lib/server/data/moderation-queue.ts';

let commentId: string;
beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('author', { username: 'author' }),
			userValues('named', { username: 'reporter_one' }),
			userValues('nameless')
		]);
	const [title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	const created = await createComment({ title, userId: 'author', body: 'Reported' });
	if (!created.ok) throw new Error(created.reason);
	commentId = created.comment.id;
});

describe('listReportedQueue reporters', () => {
	it('selects each open report’s reporter username, null when the account has none', async () => {
		await db.insert(commentReports).values([
			{ commentId, reporterId: 'named', reason: 'spam' },
			{ commentId, reporterId: 'nameless', reason: 'hate' }
		]);
		const [item] = await listReportedQueue();
		expect(item.reports).toHaveLength(2);
		expect(item.reports.map((r) => [r.reason, r.reporter]).sort()).toEqual([
			['hate', null],
			['spam', 'reporter_one']
		]);
	});

	it('leaves a resolved report out', async () => {
		await db
			.insert(commentReports)
			.values({ commentId, reporterId: 'named', reason: 'spam', status: 'dismissed' });
		expect((await listReportedQueue()).flatMap((i) => i.reports)).toEqual([]);
	});
});
