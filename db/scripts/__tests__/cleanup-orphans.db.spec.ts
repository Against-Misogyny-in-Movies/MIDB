import { describe, it, expect } from 'vitest';
import { accounts, passkeys, retiredUsernames, sessions, users } from '#db/schema/auth.ts';
import { comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import {
	cleanupOrphans,
	cleanupRetiredUsernames,
	ORPHAN_AFTER_MS
} from '#db/scripts/cleanup-orphans.ts';
import { scrubAccount } from '#lib/server/data/account-scrub.ts';
import { RETIRED_USERNAME_DAYS } from '#lib/media/utils/username.ts';
import { DAY_MS } from '#lib/media/utils/time.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';

const NOW = new Date('2026-11-12T10:00:00Z');
const old = new Date(NOW.getTime() - ORPHAN_AFTER_MS - 60_000);
const recent = new Date(NOW.getTime() - ORPHAN_AFTER_MS + 60_000);

const account = (id: string, userId: string) => ({
	id,
	accountId: id,
	providerId: 'google',
	userId
});
const passkey = (id: string, userId: string) => ({
	id,
	publicKey: 'k',
	userId,
	credentialID: id,
	counter: 0,
	deviceType: 'singleDevice',
	backedUp: false
});

const remaining = async () => (await db.select({ id: users.id }).from(users)).map((u) => u.id);

describe('cleanupOrphans', () => {
	it('removes an old user with no account, no passkey and no session', async () => {
		await db.insert(users).values(userValues('orphan', { createdAt: old }));
		expect(await cleanupOrphans(db, NOW)).toBe(1);
		expect(await remaining()).toEqual([]);
	});

	it('keeps an old user that has a session', async () => {
		await db.insert(users).values(userValues('signed-in', { createdAt: old }));
		await db.insert(sessions).values({
			id: 's1',
			token: 't1',
			userId: 'signed-in',
			expiresAt: new Date(NOW.getTime() + 1000)
		});
		expect(await cleanupOrphans(db, NOW)).toBe(0);
		expect(await remaining()).toEqual(['signed-in']);
	});

	it('keeps a user created within the hour', async () => {
		await db.insert(users).values(userValues('fresh', { createdAt: recent }));
		expect(await cleanupOrphans(db, NOW)).toBe(0);
		expect(await remaining()).toEqual(['fresh']);
	});

	it('keeps an old user with an account or a passkey', async () => {
		await db
			.insert(users)
			.values([
				userValues('with-account', { createdAt: old }),
				userValues('with-passkey', { createdAt: old }),
				userValues('orphan', { createdAt: old })
			]);
		await db.insert(accounts).values(account('a1', 'with-account'));
		await db.insert(passkeys).values(passkey('p1', 'with-passkey'));

		expect(await cleanupOrphans(db, NOW)).toBe(1);
		expect((await remaining()).sort()).toEqual(['with-account', 'with-passkey']);
	});
});

describe('scrubbed accounts', () => {
	/** A scrubbed account whose comment has another account's reply, and a live account's retired name. */
	async function seedScrubbed() {
		await db
			.insert(users)
			.values([
				userValues('gone', { username: 'gone_user', createdAt: old }),
				userValues('other', { username: 'other_user', createdAt: old })
			]);
		await db.insert(accounts).values(account('a-other', 'other'));
		const [{ id: titleId }] = await db
			.insert(titles)
			.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
			.returning();
		await db
			.insert(comments)
			.values({ id: 'c1', titleId, userId: 'gone', body: 'root', status: 'published' });
		await db.insert(comments).values({
			id: 'c2',
			titleId,
			userId: 'other',
			body: 'reply',
			status: 'published',
			parentId: 'c1',
			rootId: 'c1'
		});
		await db
			.insert(retiredUsernames)
			.values({ username: 'live_old', userId: 'other', retiredAt: new Date(0) });
		expect((await scrubAccount('gone')).ok).toBe(true);
	}

	it('keeps the row, its placeholder comment, the reply and the retired name', async () => {
		await seedScrubbed();
		expect(await cleanupOrphans(db, new Date(NOW.getTime() + 400 * DAY_MS))).toBe(0);
		expect(await remaining()).toContain('gone');
		const ids = (await db.select({ id: comments.id }).from(comments)).map((c) => c.id).sort();
		expect(ids).toEqual(['c1', 'c2']);
		const names = (await db.select().from(retiredUsernames)).map((r) => r.username);
		expect(names).toContain('gone_user');
	});

	it('removes a deleted account retired names past the window and no others', async () => {
		await seedScrubbed();
		const within = new Date(Date.now() + (RETIRED_USERNAME_DAYS - 1) * DAY_MS);
		expect(await cleanupRetiredUsernames(db, within)).toBe(0);
		const past = new Date(Date.now() + (RETIRED_USERNAME_DAYS + 1) * DAY_MS);
		expect(await cleanupRetiredUsernames(db, past)).toBe(1);
		const names = (await db.select().from(retiredUsernames)).map((r) => r.username);
		expect(names).toEqual(['live_old']);
	});
});
