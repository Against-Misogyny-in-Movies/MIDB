import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import {
	commentReports,
	commentVotes,
	communityContentReports,
	comments,
	titleCountFlags
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import {
	approveReport,
	rejectAccountReports,
	rejectReport
} from '#lib/server/data/community-report-moderation.ts';
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import type { ModerationResult } from '#lib/server/data/moderation-actions.ts';
import type { ReportModerationResult } from '#lib/server/data/community-report-moderation.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { flagResult } from '../action-form.ts';
import { purgeOutcome } from '../purge.ts';

// Each action's data function writes no purge; `purgeOutcome` purges what its result names, as
// the route's `act` does. These pin the tags purged for every action.

let mod: UserRow;
let film: string;
let other: string;
let reported: string;

/** Every tag purged so far, sorted, after the `waitUntil` work has run. */
async function tags(): Promise<string[]> {
	await Promise.all(waitUntilPromises);
	return purgeCalls.flatMap((c) => c.tags ?? []).sort();
}

/** What the route does: the data function, then the purge when it succeeded. */
async function settle(pending: Promise<ModerationResult | ReportModerationResult>): Promise<void> {
	const result = await pending;
	if (result.ok) await purgeOutcome(result);
}

const comment = async (status: (typeof comments.$inferInsert)['status'], titleId = film) => {
	const [row] = await db
		.insert(comments)
		.values({ titleId, userId: 'author', body: 'Text', status })
		.returning();
	return row.id;
};

const reply = async (parentId: string) => {
	await db.insert(comments).values({
		titleId: film,
		userId: 'replier',
		body: 'Reply',
		status: 'published',
		parentId,
		rootId: parentId
	});
};

beforeEach(async () => {
	resetCloudflareStub();
	await db
		.insert(users)
		.values([
			userValues('author', { username: 'author' }),
			userValues('replier', { username: 'replier' }),
			userValues('liked', { username: 'liked' }),
			userValues('reporter', { username: 'reporter' }),
			userValues('mod', { role: 'moderator' })
		]);
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	const made = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'movie', title: 'Dark', cleanTitle: 'dark', tmdbId: 603 },
			{ kind: 'tv', title: 'Lost', cleanTitle: 'lost', tmdbId: 4607 }
		])
		.returning();
	[film, other, reported] = made.map((t) => t.id);
});

describe('a comment action purges its title list and the profiles it changed', () => {
	it('approve: the title and the author', async () => {
		const id = await comment('pending');
		await settle(approveComment(mod, id, null));
		expect(await tags()).toEqual(['comments:movie:348', 'profile:author']);
	});

	it('hide and reject: the title, the author and the authors of published replies', async () => {
		const id = await comment('published');
		await reply(id);
		await settle(hideComment(mod, id, null));
		expect(await tags()).toEqual(['comments:movie:348', 'profile:author', 'profile:replier']);

		resetCloudflareStub();
		const second = await comment('published');
		await settle(rejectComment(mod, second, null));
		expect(await tags()).toEqual(['comments:movie:348', 'profile:author']);
	});

	it('restore: the title and the author', async () => {
		const id = await comment('hidden');
		await settle(restoreComment(mod, id, null));
		expect(await tags()).toEqual(['comments:movie:348', 'profile:author']);
	});

	it('dismiss: the title, and the profiles only when the comment goes public again', async () => {
		const live = await comment('published');
		await db
			.insert(commentReports)
			.values({ commentId: live, reporterId: 'reporter', reason: 'spam' });
		await settle(dismissReports(mod, live, null));
		expect(await tags()).toEqual(['comments:movie:348']);

		resetCloudflareStub();
		const sent = await comment('pending');
		await db.update(comments).set({ moderationSource: 'reports' }).where(eq(comments.id, sent));
		await db
			.insert(commentReports)
			.values({ commentId: sent, reporterId: 'reporter', reason: 'spam' });
		await settle(dismissReports(mod, sent, null));
		expect(await tags()).toEqual(['comments:movie:348', 'profile:author']);
	});

	it('a refused action purges nothing', async () => {
		const id = await comment('hidden');
		await settle(approveComment(mod, id, null));
		await settle(hideComment(mod, 'missing', null));
		expect(await tags()).toEqual([]);
	});

	it('a title with no TMDB id purges no list, only the profile', async () => {
		const [bare] = await db
			.insert(titles)
			.values({ kind: 'movie', title: 'Bare', cleanTitle: 'bare' })
			.returning();
		const id = await comment('pending', bare.id);
		await settle(approveComment(mod, id, null));
		expect(await tags()).toEqual(['profile:author']);
	});
});

describe('a mute or a ban purges the profile, the counts it leaves and, for a ban, the lists it changes', () => {
	beforeEach(async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'author', titleId: reported, status: 'counted' });
	});

	it('mute: the profile and the counts of every title the account reported', async () => {
		await settle(muteUser(mod, 'author', 24, null));
		expect(await tags()).toEqual(['profile:author', 'reports:tv:4607']);
	});

	it('ban: the profile, the counts, the lists of its hidden comments and votes, and the profiles they touch', async () => {
		const own = await comment('published');
		await reply(own);
		const liked = await db
			.insert(comments)
			.values({ titleId: other, userId: 'liked', body: 'Liked', status: 'published' })
			.returning();
		await db.insert(commentVotes).values({ commentId: liked[0].id, userId: 'author', value: 1 });
		await settle(banAccount(mod, 'author', null));
		expect(await tags()).toEqual([
			'comments:movie:348',
			'comments:movie:603',
			'profile:author',
			'profile:liked',
			'profile:replier',
			'reports:tv:4607'
		]);
	});

	it('a refused mute or ban purges nothing', async () => {
		await settle(muteUser(mod, 'mod', 24, null));
		await settle(banAccount(mod, 'nobody', null));
		expect(await tags()).toEqual([]);
	});
});

describe('a community report action purges the counts and the reporter profile', () => {
	it('count it and reject: the title counts and the profile', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'author', titleId: film, status: 'held' });
		await settle(approveReport(mod, 'author', film));
		expect(await tags()).toEqual(['profile:author', 'reports:movie:348']);

		resetCloudflareStub();
		await settle(rejectReport(mod, 'author', film));
		expect(await tags()).toEqual(['profile:author', 'reports:movie:348']);
	});

	it('reject all: the profile and the counts of each title the update changed', async () => {
		await db.insert(communityContentReports).values([
			{ userId: 'author', titleId: film, status: 'counted' },
			{ userId: 'author', titleId: reported, status: 'held' },
			{ userId: 'author', titleId: other, status: 'rejected' }
		]);
		await settle(rejectAccountReports(mod, 'author'));
		expect(await tags()).toEqual(['profile:author', 'reports:movie:348', 'reports:tv:4607']);
	});

	it('a refused report action purges nothing', async () => {
		await settle(rejectReport(mod, 'author', film));
		await settle(rejectAccountReports(mod, 'author'));
		expect(await tags()).toEqual([]);
	});
});

describe('closing a count flag purges nothing', () => {
	it('resolve and dismiss', async () => {
		const [f1, f2] = await db
			.insert(titleCountFlags)
			.values([
				{ titleId: film, reporterId: 'reporter' },
				{ titleId: other, reporterId: 'liked' }
			])
			.returning();
		for (const closed of [await resolveCountFlag(f1.id, mod), await dismissCountFlag(f2.id, mod)]) {
			const result = flagResult(closed);
			if (result.ok) await purgeOutcome(result);
		}
		expect(await tags()).toEqual([]);
	});
});
