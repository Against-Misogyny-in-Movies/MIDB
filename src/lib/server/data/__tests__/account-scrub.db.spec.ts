import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import {
	accounts,
	passkeys,
	retiredUsernames,
	sessions,
	users,
	verifications
} from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import {
	accountNotes,
	commentAiLabels,
	commentReports,
	commentVotes,
	communityBechdelRatings,
	communityContentReports,
	communityDddVotes,
	communityUmReports,
	comments,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { placeholderEmail } from '#lib/server/auth/placeholder-email.ts';
import { DELETED_ACCOUNT_NAME, DELETED_COMMENT_BODY, scrubAccount } from '../account-scrub.ts';
import { isTakenByOthers } from '../username-taken.ts';
import { findProfileOwner } from '../profile-queries.ts';
import { countingAccountWhere } from '../counting-account.ts';

const OLD = new Date(Date.now() - 100 * 86_400_000);
const SECRET = {
	email: 'anna-secret@example.org',
	name: 'Anna Secretname',
	image: 'https://img.example/anna-secret.png',
	username: 'anna_secret',
	ip: '203.0.113.77',
	agent: 'AnnaSecretBrowser/9.9',
	text: 'ANNA-SECRET-COMMENT-TEXT',
	reason: 'ANNA-SECRET-REASON',
	token: 'ANNA-SECRET-TOKEN'
};

let alien: string;
let heat: string;
let series: string;

type Status = (typeof comments.$inferInsert)['status'];

async function add(
	id: string,
	userId: string,
	titleId: string,
	status: Status,
	parent?: string,
	extra: Partial<typeof comments.$inferInsert> = {}
) {
	const root = parent
		? ((await db.select({ root: comments.rootId }).from(comments).where(eq(comments.id, parent)))[0]
				.root ?? parent)
		: undefined;
	await db.insert(comments).values({
		id,
		titleId,
		userId,
		body: `text of ${id}`,
		status,
		parentId: parent,
		rootId: root,
		...extra
	});
}

const row = async (id: string) =>
	(await db.select().from(comments).where(eq(comments.id, id)))[0] ?? null;

beforeEach(async () => {
	await db.insert(users).values([
		userValues('anna', {
			name: SECRET.name,
			email: SECRET.email,
			emailVerified: true,
			image: SECRET.image,
			username: SECRET.username,
			avatarKey: 'fox',
			role: 'moderator',
			createdAt: OLD,
			usernameChangedAt: new Date('2026-03-01T10:00:00Z')
		}),
		userValues('bob', { username: 'bob', createdAt: OLD }),
		userValues('cat', { username: 'cat', createdAt: OLD }),
		userValues('admin', { username: 'admin_one', role: 'administrator', createdAt: OLD })
	]);
	[{ id: alien }, { id: heat }, { id: series }] = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'movie', title: 'Heat', cleanTitle: 'heat', tmdbId: 949 },
			{ kind: 'tv', title: 'Severance', cleanTitle: 'severance', tmdbId: 95396 }
		])
		.returning();

	await db.insert(retiredUsernames).values({
		username: 'annie',
		userId: 'anna',
		retiredAt: new Date('2026-03-01T10:00:00Z')
	});
	await db.insert(accounts).values({
		id: 'acc-anna',
		accountId: 'google-sub-anna',
		providerId: 'google',
		userId: 'anna',
		accessToken: SECRET.token,
		refreshToken: SECRET.token,
		idToken: SECRET.token
	});
	await db.insert(passkeys).values({
		id: 'pk-anna',
		name: 'MacBook',
		publicKey: SECRET.token,
		userId: 'anna',
		credentialID: SECRET.token,
		counter: 1,
		deviceType: 'singleDevice',
		backedUp: false
	});
	await db.insert(sessions).values([
		{
			id: 's-anna',
			token: SECRET.token,
			userId: 'anna',
			expiresAt: new Date(Date.now() + 86_400_000),
			ipAddress: SECRET.ip,
			userAgent: SECRET.agent
		},
		{ id: 's-bob', token: 'bob-token', userId: 'bob', expiresAt: new Date(Date.now() + 86_400_000) }
	]);
	await db.insert(verifications).values([
		{
			id: 'v-anna',
			identifier: SECRET.email,
			value: 'x',
			expiresAt: new Date(Date.now() + 86_400_000)
		},
		{ id: 'v-bob', identifier: 'bob@example.com', value: 'x', expiresAt: new Date() }
	]);

	// Anna's comments.
	// k1: a published root with a reply by bob and a reply of her own.
	await add('k1', 'anna', alien, 'published', undefined, {
		moderationReason: SECRET.reason,
		aiVerdict: JSON.stringify({ reason: SECRET.reason }),
		score: 1,
		replyCount: 2
	});
	await add('k1-bob', 'bob', alien, 'published', 'k1');
	await add('k1-self', 'anna', alien, 'published', 'k1');
	// k2: a published root nobody answered, with a vote, a report and an AI label on it.
	await add('k2', 'anna', alien, 'published', undefined, { score: 1 });
	// k3: a pending root with a pending reply by bob.
	await add('k3', 'anna', heat, 'pending');
	await add('k3-bob', 'bob', heat, 'pending', 'k3');
	// k4: a thread of her own only.
	await add('k4', 'anna', heat, 'published', undefined, { replyCount: 1 });
	await add('k4-self', 'anna', heat, 'published', 'k4');
	// Bob's thread: her published reply, a reply of her own below it, and a nested reply of his.
	await add('b1', 'bob', series, 'published', undefined, { replyCount: 4, score: 2 });
	await add('b1-anna', 'anna', series, 'published', 'b1', { replyCount: 1 });
	await add('b1-anna-bob', 'bob', series, 'published', 'b1-anna');
	await add('b1-cat', 'cat', series, 'published', 'b1');
	await add('b1-cat-anna', 'anna', series, 'published', 'b1-cat');
	// A comment of cat's she voted on.
	await add('c1', 'cat', alien, 'published', undefined, { score: 1 });

	await db.insert(commentVotes).values([
		{ commentId: 'k2', userId: 'bob', value: 1 },
		{ commentId: 'b1', userId: 'anna', value: 1 },
		{ commentId: 'b1', userId: 'cat', value: 1 },
		{ commentId: 'c1', userId: 'anna', value: 1 },
		{ commentId: 'k1', userId: 'cat', value: 1 }
	]);
	await db.insert(commentReports).values([
		{ commentId: 'b1', reporterId: 'anna', reason: 'spam' },
		{ commentId: 'k2', reporterId: 'bob', reason: 'spam' },
		{ commentId: 'c1', reporterId: 'bob', reason: 'spam' }
	]);
	await db.insert(commentAiLabels).values([
		{
			commentId: 'k1',
			concern: 'x',
			matched: true,
			categories: '[]',
			severity: 1,
			reason: SECRET.reason,
			model: 'm'
		},
		{
			commentId: 'k2',
			concern: 'x',
			matched: true,
			categories: '[]',
			severity: 1,
			reason: SECRET.reason,
			model: 'm'
		},
		{
			commentId: 'c1',
			concern: 'x',
			matched: false,
			categories: '[]',
			severity: 0,
			reason: 'fine',
			model: 'm',
			scannedBy: 'anna'
		}
	]);
	await db.insert(communityContentReports).values([
		{ userId: 'anna', titleId: alien, status: 'counted' },
		{ userId: 'bob', titleId: alien, status: 'counted' }
	]);
	await db.insert(titleCountFlags).values([
		{ titleId: heat, reporterId: 'anna', note: SECRET.reason },
		{ titleId: heat, reporterId: 'bob' }
	]);
	await db.insert(communityBechdelRatings).values({ userId: 'anna', titleId: heat, rating: 3 });
	await db.insert(communityUmReports).values({
		userId: 'anna',
		titleId: heat,
		noRape: true,
		rapeMenDisImp: false,
		sexHarOnScrn: false,
		sexAdultTeen: false,
		childSexAbuse: false,
		incest: false,
		attemptedRape: false,
		rapeOffScrn: false,
		rapeOnScreen: false
	});
	await db
		.insert(communityDddVotes)
		.values({ userId: 'anna', titleId: heat, topicId: 1, yes: true });
	await db.insert(moderationActions).values([
		{ actorId: 'anna', targetCommentId: 'c1', action: 'approve' },
		{ actorId: 'admin', targetUserId: 'anna', action: 'mute', muteHours: 2, reason: 'rude' },
		{ actorId: 'admin', targetCommentId: 'k2', action: 'hide', reason: 'x' }
	]);
});

/** Every value of every table of the database as one string, for the "nothing personal remains" check. */
async function dumpDatabase(): Promise<string> {
	const tables = await db.all<{ name: string }>(
		sql`SELECT name FROM sqlite_master WHERE type = 'table'`
	);
	const out: Record<string, unknown[]> = {};
	for (const { name } of tables) {
		if (/^(sqlite_|_|d1_)/.test(name)) continue;
		out[name] = await db.all(sql.raw(`SELECT * FROM "${name}"`));
	}
	return JSON.stringify(out);
}

describe('scrubAccount', () => {
	it('scrubs the user row, keeps the ban state and the retired username', async () => {
		const result = await scrubAccount('anna');
		expect(result.ok).toBe(true);
		const [anna] = await db.select().from(users).where(eq(users.id, 'anna'));
		expect(anna).toMatchObject({
			name: DELETED_ACCOUNT_NAME,
			email: placeholderEmail('anna'),
			emailVerified: false,
			image: null,
			username: null,
			avatarKey: null,
			usernameChangedAt: null,
			role: 'user'
		});
		expect(anna.deletedAt).toBeInstanceOf(Date);
		const retired = await db
			.select()
			.from(retiredUsernames)
			.where(eq(retiredUsernames.userId, 'anna'));
		expect(retired.map((r) => r.username).sort()).toEqual(['anna_secret', 'annie']);
		expect(await isTakenByOthers(db, 'anna_secret', null)).toBe(true);
		expect(await findProfileOwner('anna_secret')).toBeNull();
		expect(
			await db.select({ id: users.id }).from(users).where(countingAccountWhere())
		).not.toContainEqual({ id: 'anna' });
	});

	it('keeps a ban and a mute as they were', async () => {
		const muted = new Date(Date.now() + 86_400_000);
		await db
			.update(users)
			.set({ bannedAt: new Date(), banReason: 'spam', mutedUntil: muted })
			.where(eq(users.id, 'anna'));
		await scrubAccount('anna');
		const [anna] = await db.select().from(users).where(eq(users.id, 'anna'));
		expect(anna.bannedAt).toBeInstanceOf(Date);
		expect(anna.banReason).toBe('spam');
		expect(anna.mutedUntil?.getTime()).toBe(muted.getTime());
	});

	it('deletes the linked accounts, passkeys, sessions and verification rows, and only hers', async () => {
		await scrubAccount('anna');
		expect(await db.select().from(accounts)).toEqual([]);
		expect(await db.select().from(passkeys)).toEqual([]);
		expect((await db.select().from(sessions)).map((s) => s.id)).toEqual(['s-bob']);
		expect((await db.select().from(verifications)).map((v) => v.id)).toEqual(['v-bob']);
	});

	it('deletes comments nobody answered, with their votes, reports and labels', async () => {
		await scrubAccount('anna');
		for (const id of ['k2', 'k4', 'k4-self', 'k1-self', 'b1-cat-anna']) {
			expect(await row(id), id).toBeNull();
		}
		expect(await db.select().from(commentVotes).where(eq(commentVotes.commentId, 'k2'))).toEqual(
			[]
		);
		expect(
			await db.select().from(commentReports).where(eq(commentReports.commentId, 'k2'))
		).toEqual([]);
		expect(
			await db.select().from(commentAiLabels).where(eq(commentAiLabels.commentId, 'k2'))
		).toEqual([]);
	});

	it('keeps a comment that has a reply of someone else, in any status, as a deleted marker', async () => {
		await scrubAccount('anna');
		for (const id of ['k1', 'k3', 'b1-anna']) {
			expect(await row(id), id).toMatchObject({
				userId: 'anna',
				status: 'deleted',
				body: DELETED_COMMENT_BODY,
				moderationReason: null,
				aiVerdict: null
			});
		}
		expect(
			await db.select().from(commentAiLabels).where(eq(commentAiLabels.commentId, 'k1'))
		).toEqual([]);
		// Their replies are other readers' rows and stay.
		for (const id of ['k1-bob', 'k3-bob', 'b1-anna-bob', 'b1-cat', 'b1', 'c1']) {
			expect(await row(id), id).not.toBeNull();
		}
	});

	it('keeps reply_count as the writes keep it', async () => {
		await scrubAccount('anna');
		// k1: bob's reply is published; her own reply is gone.
		expect((await row('k1'))?.replyCount).toBe(1);
		// k3: bob's reply is pending, so it counts nothing.
		expect((await row('k3'))?.replyCount).toBe(0);
		// b1's thread: her two replies no longer count; bob's nested reply and cat's do.
		expect((await row('b1'))?.replyCount).toBe(2);
		expect((await row('b1-anna'))?.replyCount).toBe(1);
		expect((await row('b1-cat'))?.replyCount).toBe(0);
	});

	it('removes her votes and recomputes the scores of the comments she voted on', async () => {
		await scrubAccount('anna');
		expect((await row('b1'))?.score).toBe(1);
		expect((await row('c1'))?.score).toBe(0);
		expect((await row('k1'))?.score).toBe(1);
		const votes = await db.select().from(commentVotes);
		expect(votes.every((v) => v.userId !== 'anna')).toBe(true);
		expect(votes.map((v) => `${v.commentId}:${v.userId}`).sort()).toEqual(['b1:cat', 'k1:cat']);
	});

	it('deletes her reports and flags and leaves other readers', async () => {
		await scrubAccount('anna');
		expect((await db.select().from(commentReports)).map((r) => r.reporterId).sort()).toEqual([
			'bob'
		]);
		expect((await db.select().from(communityContentReports)).map((r) => r.userId)).toEqual(['bob']);
		expect((await db.select().from(titleCountFlags)).map((r) => r.reporterId)).toEqual(['bob']);
		expect(await db.select().from(communityBechdelRatings)).toEqual([]);
		expect(await db.select().from(communityUmReports)).toEqual([]);
		expect(await db.select().from(communityDddVotes)).toEqual([]);
	});

	it('deletes the staff notes about her and keeps the notes about others', async () => {
		await db.insert(accountNotes).values([
			{ userId: 'anna', authorId: 'admin', body: 'NOTE-ABOUT-ANNA' },
			{ userId: 'bob', authorId: 'anna', body: 'note about bob' }
		]);
		await scrubAccount('anna');
		const notes = await db.select().from(accountNotes);
		expect(notes.map((n) => n.body)).toEqual(['note about bob']);
	});

	it('keeps the moderation log, which no longer names her', async () => {
		await scrubAccount('anna');
		const log = await db.select().from(moderationActions);
		expect(log).toHaveLength(3);
		// The deleted comment's reference is cleared by its foreign key; the account's stays and
		// points at a row with no name.
		expect(log.find((l) => l.action === 'hide')?.targetCommentId).toBeNull();
		const [anna] = await db.select().from(users).where(eq(users.id, 'anna'));
		expect(anna.username).toBeNull();
		expect(anna.email).toBe(placeholderEmail('anna'));
	});

	it('leaves no personal value of hers anywhere but the retired username', async () => {
		await scrubAccount('anna');
		const dump = await dumpDatabase();
		for (const [name, value] of Object.entries(SECRET)) {
			if (name === 'username') continue;
			expect(dump, name).not.toContain(value);
		}
		// The username survives only in the retired-name table.
		const { retired_username, ...rest } = JSON.parse(dump) as Record<string, unknown[]>;
		expect(JSON.stringify(rest)).not.toContain(SECRET.username);
		expect(JSON.stringify(retired_username)).toContain(SECRET.username);
	});

	it('leaves the other accounts untouched', async () => {
		const before = await db.select().from(users).where(eq(users.id, 'bob'));
		await scrubAccount('anna');
		expect(await db.select().from(users).where(eq(users.id, 'bob'))).toEqual(before);
		expect((await db.select().from(users).where(eq(users.id, 'admin')))[0].role).toBe(
			'administrator'
		);
	});

	it('lets the same sign-in identity register again as a new account', async () => {
		await scrubAccount('anna');
		await db.insert(users).values(userValues('anna-again', { email: SECRET.email }));
		await db.insert(accounts).values({
			id: 'acc-new',
			accountId: 'google-sub-anna',
			providerId: 'google',
			userId: 'anna-again'
		});
		expect(await db.select().from(users).where(eq(users.id, 'anna-again'))).toHaveLength(1);
		// The old name is still held back from the new account too.
		expect(await isTakenByOthers(db, SECRET.username, 'anna-again')).toBe(true);
	});

	it('returns what the purges need', async () => {
		const result = await scrubAccount('anna');
		if (!result.ok) throw new Error('expected ok');
		const key = (t: { kind: string; tmdbId: number | null }) => `${t.kind}:${t.tmdbId}`;
		expect(result.commentTitles.map(key).sort()).toEqual(['movie:348', 'movie:949', 'tv:95396']);
		expect(result.reportTitles.map(key)).toEqual(['movie:348']);
		// Bob answered two of her published comments; cat answered none of them.
		expect(result.replyAuthorIds.sort()).toEqual(['bob']);
	});
});

describe('scrubAccount and the last administrator', () => {
	it('refuses the only administrator and changes nothing', async () => {
		await db.update(users).set({ role: 'user' }).where(eq(users.id, 'admin'));
		await db.update(users).set({ role: 'administrator' }).where(eq(users.id, 'anna'));
		const before = await dumpDatabase();
		expect(await scrubAccount('anna')).toEqual({ ok: false, reason: 'last-administrator' });
		expect(await dumpDatabase()).toBe(before);
	});

	it('allows an administrator while another one can act', async () => {
		await db.update(users).set({ role: 'administrator' }).where(eq(users.id, 'anna'));
		expect((await scrubAccount('anna')).ok).toBe(true);
		const [anna] = await db.select().from(users).where(eq(users.id, 'anna'));
		expect(anna.role).toBe('user');
		// The remaining one is now the last.
		expect(await scrubAccount('admin')).toEqual({ ok: false, reason: 'last-administrator' });
	});

	it('does not count a banned administrator', async () => {
		await db.update(users).set({ role: 'administrator' }).where(eq(users.id, 'anna'));
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'admin'));
		expect(await scrubAccount('anna')).toEqual({ ok: false, reason: 'last-administrator' });
	});

	it('does not count a moderator or user as an administrator', async () => {
		await db.update(users).set({ role: 'moderator' }).where(eq(users.id, 'admin'));
		await db.update(users).set({ role: 'administrator' }).where(eq(users.id, 'anna'));
		expect(await scrubAccount('anna')).toEqual({ ok: false, reason: 'last-administrator' });
	});
});
