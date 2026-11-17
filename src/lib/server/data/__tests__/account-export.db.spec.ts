import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { accounts, passkeys, retiredUsernames, sessions, users } from '#db/schema/auth.ts';
import {
	commentReports,
	commentVotes,
	communityContentReports,
	comments,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { userValues } from '#db/test/users.ts';
import { ACCOUNT_EXPORT_VERSION, buildAccountExport } from '../account-export.ts';
import { getUserById } from '../user-queries.ts';

const DAY = 86_400_000;
const NOW = new Date('2026-11-17T12:00:00Z');
let alien: string;
let heat: string;

async function exportFor(id: string) {
	const user = await getUserById(id);
	return buildAccountExport(user!, NOW);
}

beforeEach(async () => {
	const joined = new Date('2026-01-05T10:00:00Z');
	await db.insert(users).values([
		userValues('anna-id', {
			username: 'anna',
			avatarKey: 'fox',
			createdAt: joined,
			usernameChangedAt: new Date('2026-03-01T10:00:00Z'),
			mutedUntil: new Date(Date.now() + DAY)
		}),
		userValues('bea-id', { username: 'bea', email: 'bea-secret@example.org' }),
		userValues('mod-id', { username: 'moddy', role: 'moderator' })
	]);
	[{ id: alien }, { id: heat }] = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'movie', title: 'Heat', cleanTitle: 'heat', tmdbId: 949 }
		])
		.returning();
	await db.insert(retiredUsernames).values([
		{ username: 'annie', userId: 'anna-id', retiredAt: new Date('2026-03-01T10:00:00Z') },
		{ username: 'beatrix', userId: 'bea-id', retiredAt: new Date('2026-04-01T10:00:00Z') }
	]);
	await db.insert(accounts).values([
		{
			id: 'acc-anna',
			accountId: 'google-sub-anna',
			providerId: 'google',
			userId: 'anna-id',
			accessToken: 'ACCESS-TOKEN-ANNA',
			refreshToken: 'REFRESH-TOKEN-ANNA',
			idToken: 'ID-TOKEN-ANNA',
			password: 'PASSWORD-HASH-ANNA'
		},
		{ id: 'acc-bea', accountId: 'discord-bea', providerId: 'discord', userId: 'bea-id' }
	]);
	await db.insert(passkeys).values([
		{
			id: 'pk-anna',
			name: 'MacBook',
			publicKey: 'PUBLIC-KEY-ANNA',
			userId: 'anna-id',
			credentialID: 'CREDENTIAL-ID-ANNA',
			counter: 4,
			deviceType: 'multiDevice',
			backedUp: true,
			transports: 'internal',
			aaguid: 'AAGUID-ANNA'
		},
		{
			id: 'pk-bea',
			name: 'Bea key',
			publicKey: 'PUBLIC-KEY-BEA',
			userId: 'bea-id',
			credentialID: 'CREDENTIAL-ID-BEA',
			counter: 1,
			deviceType: 'singleDevice',
			backedUp: false
		}
	]);
	await db.insert(sessions).values([
		{
			id: 'sess-anna',
			token: 'SESSION-TOKEN-ANNA',
			userId: 'anna-id',
			expiresAt: new Date(Date.now() + 7 * DAY),
			ipAddress: '203.0.113.7',
			userAgent: 'Firefox/132.0',
			createdAt: new Date('2026-11-14T10:00:00Z')
		},
		{
			id: 'sess-bea',
			token: 'SESSION-TOKEN-BEA',
			userId: 'bea-id',
			expiresAt: new Date(Date.now() + 7 * DAY),
			ipAddress: '198.51.100.9',
			userAgent: 'BEA-BROWSER'
		}
	]);
	await db.insert(comments).values([
		{
			id: 'c-root',
			titleId: alien,
			userId: 'bea-id',
			body: 'Bea writes this',
			status: 'published',
			score: 5
		},
		{
			id: 'c-anna-pub',
			titleId: alien,
			userId: 'anna-id',
			parentId: 'c-root',
			rootId: 'c-root',
			body: 'Anna replies',
			status: 'published',
			score: 2,
			editedAt: new Date('2026-11-02T10:00:00Z'),
			moderationSource: 'ai',
			aiVerdict: JSON.stringify({ secret: 'AI-VERDICT-INTERNALS' })
		},
		{
			id: 'c-anna-rej',
			titleId: heat,
			userId: 'anna-id',
			body: 'Anna rejected',
			status: 'rejected',
			moderationSource: 'moderator',
			moderationReason: 'A slur'
		},
		{ id: 'c-anna-pending', titleId: heat, userId: 'anna-id', body: 'Anna waits' }
	]);
	await db.insert(communityContentReports).values([
		{
			userId: 'anna-id',
			titleId: alien,
			sexualPresent: 'present',
			partnerLevel: 'mentioned',
			physicalLevel: 'on_screen',
			stalkingLevel: null,
			objectificationLevel: 'some_scenes',
			framing: 'condemned',
			incest: true,
			rapeOnScreen: false,
			status: 'held',
			holdReason: 'burst'
		},
		{ userId: 'bea-id', titleId: alien, sexualPresent: 'none', status: 'counted' }
	]);
	await db.insert(commentVotes).values([
		{ commentId: 'c-root', userId: 'anna-id', value: 1 },
		{ commentId: 'c-anna-pub', userId: 'bea-id', value: -1 }
	]);
	await db.insert(commentReports).values([
		{
			id: 'cr-anna',
			commentId: 'c-root',
			reporterId: 'anna-id',
			reason: 'harassment',
			note: 'Anna’s note',
			status: 'resolved',
			resolvedBy: 'mod-id'
		},
		{ id: 'cr-bea', commentId: 'c-anna-pub', reporterId: 'bea-id', reason: 'spam' }
	]);
	await db.insert(titleCountFlags).values([
		{
			id: 'f-anna',
			titleId: alien,
			reporterId: 'anna-id',
			note: 'Counts look off',
			status: 'resolved',
			resolvedBy: 'mod-id'
		},
		{ id: 'f-bea', titleId: heat, reporterId: 'bea-id', note: 'Bea flag' }
	]);
	await db.insert(moderationActions).values({
		actorId: 'mod-id',
		targetUserId: 'anna-id',
		action: 'mute',
		reason: 'MODERATION-LOG-REASON',
		muteHours: 24
	});
});

describe('buildAccountExport', () => {
	it('carries a format version, the export time and the account fields, with the real email', async () => {
		const out = await exportFor('anna-id');
		expect(out.formatVersion).toBe(ACCOUNT_EXPORT_VERSION);
		expect(out.exportedAt).toBe('2026-11-17T12:00:00.000Z');
		expect(out.account).toMatchObject({
			username: 'anna',
			avatarKey: 'fox',
			role: 'user',
			joinedAt: '2026-01-05T10:00:00.000Z',
			usernameChangedAt: '2026-03-01T10:00:00.000Z',
			email: 'anna-id@example.com',
			retiredUsernames: [{ username: 'annie', retiredAt: '2026-03-01T10:00:00.000Z' }]
		});
		expect(out.account.mutedUntil).toBeTypeOf('string');
	});

	it('omits the placeholder email of a passkey-only account', async () => {
		await db
			.insert(users)
			.values(userValues('pk-only', { username: 'pk', email: 'pk-only@users.invalid' }));
		expect((await exportFor('pk-only')).account.email).toBeNull();
	});

	it('lists sign-in methods by provider and label with no key, token or credential id', async () => {
		const out = await exportFor('anna-id');
		expect(out.signInMethods.linkedAccounts).toEqual([
			{ provider: 'google', addedAt: expect.any(String) }
		]);
		expect(out.signInMethods.passkeys).toEqual([
			{
				label: 'MacBook',
				deviceType: 'multiDevice',
				syncedAcrossDevices: true,
				addedAt: expect.any(String)
			}
		]);
	});

	it('lists the sessions with their IP address and browser, without the token', async () => {
		const out = await exportFor('anna-id');
		expect(out.sessions).toEqual([
			{
				startedAt: '2026-11-14T10:00:00.000Z',
				expiresAt: expect.any(String),
				ipAddress: '203.0.113.7',
				userAgent: 'Firefox/132.0'
			}
		]);
	});

	it('lists comments in every status with their title, parent and the reason of a rejection', async () => {
		const out = await exportFor('anna-id');
		expect(out.comments.map((c) => c.id).sort()).toEqual([
			'c-anna-pending',
			'c-anna-pub',
			'c-anna-rej'
		]);
		const reply = out.comments.find((c) => c.id === 'c-anna-pub')!;
		expect(reply).toMatchObject({
			parentId: 'c-root',
			body: 'Anna replies',
			status: 'published',
			score: 2,
			editedAt: '2026-11-02T10:00:00.000Z',
			title: { kind: 'movie', tmdbId: 348, name: 'Alien' }
		});
		expect(out.comments.find((c) => c.id === 'c-anna-rej')).toMatchObject({
			status: 'rejected',
			moderationReason: 'A slur'
		});
	});

	it('lists community reports with every answer, the status and the hold reason', async () => {
		const out = await exportFor('anna-id');
		expect(out.communityReports).toHaveLength(1);
		const report = out.communityReports[0];
		expect(report).toMatchObject({
			title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
			status: 'held',
			holdReason: 'burst',
			answers: {
				sexualViolence: 'present',
				partnerOrFamilyAbuse: 'mentioned',
				physicalViolence: 'on_screen',
				stalking: null,
				objectification: 'some_scenes',
				framing: 'condemned'
			}
		});
		expect(report.answers.concerns).toMatchObject({ incest: true, rapeOnScreen: false });
		expect(report.answers.concerns.childSexAbuse).toBeNull();
	});

	it('lists votes, the reports made on comments and the count flags raised', async () => {
		const out = await exportFor('anna-id');
		expect(out.votes).toEqual([{ commentId: 'c-root', value: 1 }]);
		expect(out.commentReports).toEqual([
			{
				commentId: 'c-root',
				reason: 'harassment',
				note: 'Anna’s note',
				status: 'resolved',
				createdAt: expect.any(String)
			}
		]);
		expect(out.countFlags).toEqual([
			{
				title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
				note: 'Counts look off',
				status: 'resolved',
				createdAt: expect.any(String)
			}
		]);
	});

	it('holds nothing of another account', async () => {
		const text = JSON.stringify(await exportFor('anna-id'));
		for (const other of [
			'bea-id',
			'bea-secret',
			'Bea writes this',
			'Bea flag',
			'BEA-BROWSER',
			'198.51.100.9',
			'Bea key',
			'beatrix',
			'discord'
		]) {
			expect(text).not.toContain(other);
		}
	});

	it('holds no token, key, credential id, moderator or classifier field or value', async () => {
		const text = JSON.stringify(await exportFor('anna-id'));
		for (const secret of [
			'ACCESS-TOKEN-ANNA',
			'REFRESH-TOKEN-ANNA',
			'ID-TOKEN-ANNA',
			'PASSWORD-HASH-ANNA',
			'SESSION-TOKEN-ANNA',
			'PUBLIC-KEY-ANNA',
			'CREDENTIAL-ID-ANNA',
			'AAGUID-ANNA',
			'google-sub-anna',
			'AI-VERDICT-INTERNALS',
			'MODERATION-LOG-REASON',
			'mod-id',
			'moddy'
		]) {
			expect(text).not.toContain(secret);
		}
		for (const field of [
			'token',
			'password',
			'publicKey',
			'credentialID',
			'resolvedBy',
			'resolved_by',
			'actorId',
			'actor_id',
			'scannedBy',
			'scanned_by',
			'aiVerdict',
			'moderationSource'
		]) {
			expect(text.toLowerCase()).not.toContain(`"${field.toLowerCase()}"`);
		}
	});

	it('is empty in every list for an account that has done nothing', async () => {
		const out = await exportFor('mod-id');
		expect(out).toMatchObject({
			comments: [],
			communityReports: [],
			votes: [],
			commentReports: [],
			countFlags: [],
			sessions: [],
			signInMethods: { linkedAccounts: [], passkeys: [] }
		});
		expect(out.account.role).toBe('moderator');
	});
});
