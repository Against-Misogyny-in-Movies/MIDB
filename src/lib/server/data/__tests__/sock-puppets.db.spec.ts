import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentVotes, comments, communityContentReports } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { reportComment } from '#lib/server/data/comment-reports.ts';
import { removeVote, setVote } from '#lib/server/data/comment-votes.ts';
import { banAccount } from '#lib/server/data/moderation-actions.ts';
import { upsertReport, type ReportAnswers } from '#lib/server/data/community-reports.ts';
import { BURST_COUNT, REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import { REPORT_THRESHOLD } from '#lib/media/utils/comments.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

const DAY = 86_400_000;
const aged = (days: number) => new Date(Date.now() - days * DAY);

let titleId: string;
let admin: UserRow;

async function addUser(id: string, ageDays = 100, over: Partial<typeof users.$inferInsert> = {}) {
	await db
		.insert(users)
		.values(userValues(id, { createdAt: aged(ageDays), updatedAt: aged(ageDays), ...over }));
}

const userRow = async (id: string): Promise<UserRow> =>
	(await db.select().from(users).where(eq(users.id, id)))[0];

async function addComment(
	id: string,
	userId: string,
	over: Partial<typeof comments.$inferInsert> = {}
) {
	await db
		.insert(comments)
		.values({ id, titleId, userId, body: `Body of ${id}`, status: 'published', ...over });
}

const row = async (id: string) => (await db.select().from(comments).where(eq(comments.id, id)))[0];

beforeEach(async () => {
	await addUser('author');
	await addUser('admin', 100, { role: 'administrator' });
	admin = await userRow('admin');
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning({ id: titles.id });
});

describe('reports that hide a comment', () => {
	async function reportAll(commentId: string, reporters: string[]) {
		for (const reporterId of reporters)
			await reportComment({ commentId, reporterId, reason: 'spam' });
	}

	it('do not reach the threshold from young, muted or banned accounts', async () => {
		await addComment('c1', 'author');
		await addUser('young', REPORT_ACCOUNT_MIN_AGE_DAYS - 1);
		await addUser('muted', 100, { mutedUntil: new Date(Date.now() + DAY) });
		await addUser('banned', 100, { bannedAt: new Date() });
		await addUser('honest');
		await reportAll('c1', ['young', 'muted', 'banned', 'honest']);
		expect((await row('c1')).status).toBe('published');
	});

	it('are still stored and listed for staff', async () => {
		await addComment('c1', 'author');
		await addUser('young', 1);
		const result = await reportComment({ commentId: 'c1', reporterId: 'young', reason: 'spam' });
		expect(result).toMatchObject({ ok: true, alreadyReported: false });
	});

	it('count from old accounts and from staff', async () => {
		await addComment('c1', 'author');
		await addUser('old1');
		await addUser('mod', 0, { role: 'moderator' });
		await addUser('young', 1);
		await reportAll('c1', ['young', 'old1', 'mod']);
		expect((await row('c1')).status).toBe('published');
		await reportAll('c1', ['admin']);
		expect(REPORT_THRESHOLD).toBe(3);
		expect(await row('c1')).toMatchObject({ status: 'pending', moderationSource: 'reports' });
	});
});

describe('votes need an account age', () => {
	it('refuses a young voter, accepts an old voter and staff, and lets a vote be removed', async () => {
		await addComment('c1', 'author');
		await addUser('young', REPORT_ACCOUNT_MIN_AGE_DAYS - 1);
		await addUser('old');
		await addUser('mod', 0, { role: 'moderator' });

		expect(await setVote('c1', await userRow('young'), 1)).toEqual({
			ok: false,
			reason: 'account-too-new'
		});
		expect(await db.select().from(commentVotes)).toHaveLength(0);
		expect(await setVote('c1', await userRow('old'), 1)).toMatchObject({ ok: true, score: 1 });
		expect(await setVote('c1', await userRow('mod'), 1)).toMatchObject({ ok: true, score: 2 });

		await db.insert(commentVotes).values({ commentId: 'c1', userId: 'young', value: 1 });
		expect(await removeVote('c1', 'young')).toMatchObject({ ok: true, vote: null });
	});
});

describe('a ban takes the account’s weight away', () => {
	it('deletes its votes, recomputes scores and hides its published and pending comments', async () => {
		await addUser('bad');
		await addUser('other');
		await addComment('root', 'author');
		await addComment('reply', 'bad', { parentId: 'root', rootId: 'root' });
		await addComment('mine', 'bad');
		await addComment('waiting', 'bad', { status: 'pending' });
		await addComment('gone', 'bad', { status: 'rejected', moderationSource: 'ai' });
		await db.update(comments).set({ replyCount: 1 }).where(eq(comments.id, 'root'));
		await db.insert(commentVotes).values([
			{ commentId: 'root', userId: 'bad', value: 1 },
			{ commentId: 'root', userId: 'other', value: 1 },
			{ commentId: 'reply', userId: 'other', value: 1 }
		]);
		await db.update(comments).set({ score: 2 }).where(eq(comments.id, 'root'));

		expect(await banAccount(admin, 'bad', 'sock puppet')).toMatchObject({ ok: true });

		expect(await db.select().from(commentVotes)).toHaveLength(2);
		expect((await row('root')).score).toBe(1);
		expect((await row('root')).replyCount).toBe(0);
		for (const id of ['reply', 'mine', 'waiting'])
			expect(await row(id)).toMatchObject({
				status: 'hidden',
				moderationSource: 'moderator',
				moderationReason: 'Account banned'
			});
		expect(await row('gone')).toMatchObject({ status: 'rejected', moderationSource: 'ai' });
		expect((await userRow('bad')).bannedAt).not.toBeNull();
	});
});

describe('a ban and the reply counts of nested threads', () => {
	it('takes a nested reply off its parent and its root, whose parent is not the root', async () => {
		await addUser('bad');
		await addUser('other');
		await addComment('root', 'author');
		await addComment('mid', 'other', { parentId: 'root', rootId: 'root' });
		await addComment('deep', 'bad', { parentId: 'mid', rootId: 'root' });
		await addComment('sibling', 'other', { parentId: 'root', rootId: 'root' });
		await db.update(comments).set({ replyCount: 3 }).where(eq(comments.id, 'root'));
		await db.update(comments).set({ replyCount: 1 }).where(eq(comments.id, 'mid'));

		expect(await banAccount(admin, 'bad', null)).toMatchObject({ ok: true });

		expect(await row('deep')).toMatchObject({ status: 'hidden' });
		expect((await row('mid')).replyCount).toBe(0);
		expect((await row('root')).replyCount).toBe(2);
		expect(await row('mid')).toMatchObject({ status: 'published' });
		expect(await row('sibling')).toMatchObject({ status: 'published' });
	});

	it('hides a banned account replying under its own comment and keeps others’ replies counted', async () => {
		await addUser('bad');
		await addUser('other');
		await addComment('mine', 'bad');
		await addComment('mine-reply', 'bad', { parentId: 'mine', rootId: 'mine' });
		await addComment('their-reply', 'other', { parentId: 'mine', rootId: 'mine' });
		await addComment('nested', 'other', { parentId: 'mine-reply', rootId: 'mine' });
		await db.update(comments).set({ replyCount: 3 }).where(eq(comments.id, 'mine'));
		await db.update(comments).set({ replyCount: 1 }).where(eq(comments.id, 'mine-reply'));

		expect(await banAccount(admin, 'bad', null)).toMatchObject({ ok: true });

		for (const id of ['mine', 'mine-reply'])
			expect(await row(id)).toMatchObject({ status: 'hidden', moderationReason: 'Account banned' });
		expect(await row('their-reply')).toMatchObject({ status: 'published' });
		expect(await row('nested')).toMatchObject({ status: 'published' });
		// Only the banned account's own reply leaves the count; the others' stay.
		expect((await row('mine')).replyCount).toBe(2);
		expect((await row('mine-reply')).replyCount).toBe(1);
	});
});

describe('bursts from fresh accounts', () => {
	const answers: ReportAnswers = {
		sexualPresent: null,
		partnerLevel: 'on_screen',
		physicalLevel: null,
		stalkingLevel: null,
		objectificationLevel: null,
		flags: {},
		framing: null
	};
	const REF = { title: 'Alien', imdbId: null, tmdbId: '348', releaseDate: '1979-05-25' };

	it('ignores young accounts when counting a title’s reports in the window', async () => {
		for (let i = 0; i < BURST_COUNT - 1; i++) {
			await addUser(`y${i}`, 1);
			await db.insert(communityContentReports).values({ userId: `y${i}`, titleId });
		}
		await addUser('reader');
		const result = await upsertReport({ id: 'reader', role: 'user' }, 'movie', REF, answers);
		expect(result).toMatchObject({ status: 'counted', holdReason: null });
	});
});
