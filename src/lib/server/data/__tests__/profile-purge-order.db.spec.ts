import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { communityContentReports } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

let titleReadFails = false;
// The title read after the update is the only chunked read on this path.
vi.mock(import('#db/lib/chunkForD1.ts'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		chunkForD1: ((...args: Parameters<typeof actual.chunkForD1>) => {
			if (titleReadFails) throw new Error('title read failed');
			return actual.chunkForD1(...args);
		}) as typeof actual.chunkForD1
	};
});

vi.mock(import('#lib/server/data/community-report-moderation.ts'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		purgeReportedTitles: vi.fn(async () => {
			throw new Error('title read failed');
		})
	};
});

const { banAccount, muteUser } = await import('#lib/server/data/moderation-actions.ts');
const { rejectAccountReports } = await import('#lib/server/data/community-report-moderation.ts');

let mod: UserRow;
let titleId: string;

const profilePurges = async () => {
	await Promise.all(waitUntilPromises);
	return purgeCalls.flatMap((c) => c.tags ?? []).filter((t) => t.startsWith('profile:'));
};

beforeEach(async () => {
	resetCloudflareStub();
	titleReadFails = false;
	await db
		.insert(users)
		.values([
			userValues('author', { username: 'author' }),
			userValues('mod', { role: 'moderator' })
		]);
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	const [title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = title.id;
});

describe('the profile purge comes before the awaited title read', () => {
	it('a ban whose title read fails has purged the profile', async () => {
		await expect(banAccount(mod, 'author', null)).rejects.toThrow('title read failed');
		expect(await profilePurges()).toEqual(['profile:author']);
	});

	it('a mute whose title read fails has purged the profile', async () => {
		await expect(muteUser(mod, 'author', 24, null)).rejects.toThrow('title read failed');
		expect(await profilePurges()).toEqual(['profile:author']);
	});

	it('rejecting every report of an account purges the profile before it reads the titles', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'author', titleId, status: 'counted' });
		titleReadFails = true;
		await expect(rejectAccountReports(mod, 'author')).rejects.toThrow('title read failed');
		expect(await profilePurges()).toEqual(['profile:author']);
	});
});
