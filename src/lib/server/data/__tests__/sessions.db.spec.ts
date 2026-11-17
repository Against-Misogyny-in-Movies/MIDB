import { beforeEach, describe, expect, it } from 'vitest';
import { sessions, users } from '#db/schema/auth.ts';
import { userValues } from '#db/test/users.ts';
import { db } from '#lib/server/db.ts';
import { countLiveSessions, endOtherSessions, endSession, listLiveSessions } from '../sessions.ts';

const DAY = 24 * 60 * 60 * 1000;

const session = (
	id: string,
	userId: string,
	over: Partial<typeof sessions.$inferInsert> = {}
): typeof sessions.$inferInsert => ({
	id,
	token: `token-${id}`,
	userId,
	expiresAt: new Date(Date.now() + 7 * DAY),
	ipAddress: '203.0.113.7',
	userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
	...over
});

beforeEach(async () => {
	await db.insert(users).values([userValues('anna'), userValues('ben')]);
	await db
		.insert(sessions)
		.values([
			session('a-old', 'anna', { createdAt: new Date('2026-11-01T10:00:00Z') }),
			session('a-new', 'anna', { createdAt: new Date('2026-11-10T10:00:00Z') }),
			session('a-expired', 'anna', { expiresAt: new Date(Date.now() - DAY) }),
			session('b-1', 'ben')
		]);
});

describe('listLiveSessions', () => {
	it('lists the account’s unexpired sessions, newest first, without a token or an IP address', async () => {
		const rows = await listLiveSessions('anna');
		expect(rows.map((r) => r.id)).toEqual(['a-new', 'a-old']);
		expect(Object.keys(rows[0]).sort()).toEqual(['createdAt', 'id', 'userAgent']);
	});
});

describe('countLiveSessions', () => {
	it('counts the unexpired sessions of the account only', async () => {
		expect(await countLiveSessions('anna')).toBe(2);
		expect(await countLiveSessions('ben')).toBe(1);
		expect(await countLiveSessions('nobody')).toBe(0);
	});
});

describe('endSession', () => {
	it('ends one session of the account', async () => {
		await endSession('anna', 'a-old');
		expect((await listLiveSessions('anna')).map((r) => r.id)).toEqual(['a-new']);
	});

	it('ends nothing of another account', async () => {
		await endSession('anna', 'b-1');
		expect(await countLiveSessions('ben')).toBe(1);
	});

	it('is not an error when the session is already gone', async () => {
		await endSession('anna', 'a-old');
		await expect(endSession('anna', 'a-old')).resolves.toBeUndefined();
	});
});

describe('endOtherSessions', () => {
	it('keeps the given session and ends the account’s others, leaving other accounts alone', async () => {
		await endOtherSessions('anna', 'a-new');
		expect((await listLiveSessions('anna')).map((r) => r.id)).toEqual(['a-new']);
		expect(await countLiveSessions('ben')).toBe(1);
	});
});
