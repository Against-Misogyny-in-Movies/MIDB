import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import {
	communityContentReports as reports,
	moderationActions,
	titleCountFlags
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	approveReport,
	listFlaggedTitles,
	listHeldReports,
	listTitleReports,
	rejectAccountReports,
	rejectReport
} from '#lib/server/data/reader-report-moderation.ts';
import { banAccount, muteUser } from '#lib/server/data/moderation-actions.ts';
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import { getReportCounts } from '#lib/server/data/reader-reports.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

const purged = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/http/purge-title.ts', () => ({ purgeTitleReports: purged }));

const DAY = 86_400_000;
let mod: UserRow;
let a: string;
let b: string;

beforeEach(async () => {
	purged.mockClear();
	const old = new Date(Date.now() - 100 * DAY);
	await db
		.insert(users)
		.values([
			userValues('r1', { createdAt: old, updatedAt: old }),
			userValues('r2', { createdAt: old, updatedAt: old }),
			userValues('mod', { role: 'moderator' })
		]);
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	const rows = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'tv', title: 'Dark', cleanTitle: 'dark', tmdbId: 70523 }
		])
		.returning();
	[a, b] = rows.map((t) => t.id);
});

const report = (
	userId: string,
	titleId: string,
	status: 'counted' | 'held' | 'rejected' = 'counted',
	holdReason: 'busy_new_account' | 'contradicts_source' | null = null
) =>
	db
		.insert(reports)
		.values({ userId, titleId, status, holdReason, partnerLevel: 'on_screen' })
		.then(() => undefined);

const statusOf = async (userId: string, titleId: string) =>
	(await db.select().from(reports)).find((r) => r.userId === userId && r.titleId === titleId)!;
const log = () => db.select().from(moderationActions);
const onScreen = async (titleId: string) =>
	(await getReportCounts(titleId)).categories.partner.on_screen;

describe('approveReport and rejectReport', () => {
	it('counts a held report, clears its reason, logs it and purges the title', async () => {
		await report('r1', a, 'held', 'busy_new_account');
		expect(await onScreen(a)).toBe(0);
		const result = await approveReport(mod, 'r1', a);
		expect(result).toMatchObject({ ok: true, titles: [{ kind: 'movie', tmdbId: 348 }] });
		const row = await statusOf('r1', a);
		expect(row).toMatchObject({ status: 'counted', holdReason: null });
		expect(await onScreen(a)).toBe(1);
		expect(await log()).toMatchObject([
			{ action: 'approve_report', actorId: 'mod', targetUserId: 'r1', targetTitleId: a }
		]);
		expect(purged).toHaveBeenCalledTimes(1);
		expect(purged).toHaveBeenCalledWith(expect.objectContaining({ kind: 'movie', tmdbId: 348 }));
	});

	it('rejects a counted report out of the counts', async () => {
		await report('r1', a);
		expect(await onScreen(a)).toBe(1);
		expect((await rejectReport(mod, 'r1', a)).ok).toBe(true);
		expect((await statusOf('r1', a)).status).toBe('rejected');
		expect(await onScreen(a)).toBe(0);
		expect(await log()).toMatchObject([{ action: 'reject_report', targetTitleId: a }]);
		expect(purged).toHaveBeenCalledTimes(1);
	});

	it('refuses a report in the wrong state or missing, with no log row and no purge', async () => {
		await report('r1', a, 'rejected');
		expect(await rejectReport(mod, 'r1', a)).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await approveReport(mod, 'r2', a)).toEqual({ ok: false, reason: 'not-found' });
		expect(await log()).toHaveLength(0);
		expect(purged).not.toHaveBeenCalled();
	});
});

describe('rejectAccountReports', () => {
	it('rejects every report of the account on every title, logging once and purging each', async () => {
		await report('r1', a);
		await report('r1', b, 'held', 'busy_new_account');
		await report('r2', a);
		const result = await rejectAccountReports(mod, 'r1');
		expect(result.ok && result.titles).toHaveLength(2);
		expect((await statusOf('r1', a)).status).toBe('rejected');
		expect((await statusOf('r1', b)).status).toBe('rejected');
		expect((await statusOf('r2', a)).status).toBe('counted');
		const rows = await log();
		expect(rows).toMatchObject([
			{ action: 'reject_account_reports', targetUserId: 'r1', targetTitleId: null }
		]);
		expect(rows).toHaveLength(1);
		expect(purged).toHaveBeenCalledTimes(2);
		expect(await onScreen(a)).toBe(1);
	});

	it('refuses an unknown account and one with nothing left to reject', async () => {
		expect(await rejectAccountReports(mod, 'nobody')).toEqual({ ok: false, reason: 'not-found' });
		await report('r1', a, 'rejected');
		expect(await rejectAccountReports(mod, 'r1')).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await log()).toHaveLength(0);
	});
});

describe('mute and ban purge the counts of every reported title', () => {
	it('purges both titles on a mute, and the counts drop the account', async () => {
		await report('r1', a);
		await report('r1', b, 'held', 'busy_new_account');
		await muteUser(mod, 'r1', 24, null);
		expect(purged).toHaveBeenCalledTimes(2);
		expect(await onScreen(a)).toBe(0);
	});

	it('purges both titles on a ban', async () => {
		await report('r1', a);
		await report('r1', b);
		await banAccount(mod, 'r1', null);
		expect(purged).toHaveBeenCalledTimes(2);
	});

	it('purges nothing for an account with no reports', async () => {
		await muteUser(mod, 'r2', 24, null);
		expect(purged).not.toHaveBeenCalled();
	});
});

describe('count flag actions', () => {
	it('log resolve and dismiss with the title, and purge nothing', async () => {
		const [f1] = await db
			.insert(titleCountFlags)
			.values({ titleId: a, reporterId: 'r1' })
			.returning();
		const [f2] = await db
			.insert(titleCountFlags)
			.values({ titleId: b, reporterId: 'r2' })
			.returning();
		expect(await resolveCountFlag(f1.id, 'mod')).toBe(true);
		expect(await dismissCountFlag(f2.id, 'mod')).toBe(true);
		expect(await resolveCountFlag(f1.id, 'mod')).toBe(false);
		const rows = (await log()).map((r) => [r.action, r.targetTitleId, r.actorId]).sort();
		expect(rows).toEqual([
			['dismiss_count_flag', b, 'mod'],
			['resolve_count_flag', a, 'mod']
		]);
		expect(purged).not.toHaveBeenCalled();
	});

	it('writes no log row for a missing flag', async () => {
		expect(await resolveCountFlag('nope', 'mod')).toBe(false);
		expect(await log()).toHaveLength(0);
	});
});

describe('queues', () => {
	it('lists held reports with the account, and UM flags only for contradicts_source', async () => {
		await db.insert(umSource).values({
			umId: 1,
			cleanName: 'alien',
			cleanTitleKey: 'alien',
			noRape: false,
			rapeMenDisImp: false,
			sexHarOnScrn: false,
			sexAdultTeen: false,
			childSexAbuse: false,
			incest: false,
			attemptedRape: false,
			rapeOffScrn: false,
			rapeOnScreen: true
		});
		await db.insert(titleUm).values({ titleId: a, umId: 1 });
		await report('r1', a, 'held', 'contradicts_source');
		await report('r1', b, 'held', 'busy_new_account');
		await report('r2', a);
		const held = await listHeldReports();
		expect(held).toHaveLength(2);
		const first = held.find((h) => h.titleId === a)!;
		expect(first).toMatchObject({
			holdReason: 'contradicts_source',
			title: { name: 'Alien', kind: 'movie', tmdbId: 348 },
			account: { userId: 'r1', reportCount: 2, commentCount: 0 },
			answers: { partnerLevel: 'on_screen' },
			um: { rapeOnScreen: true }
		});
		expect(held.find((h) => h.titleId === b)!.um).toBeNull();
	});

	it('lists every report on a title with its account and status', async () => {
		await report('r1', a);
		await report('r2', a, 'rejected');
		const list = await listTitleReports(a);
		expect(list.map((r) => [r.account.userId, r.status]).sort()).toEqual([
			['r1', 'counted'],
			['r2', 'rejected']
		]);
		expect(list[0].account.createdAt).toMatch(/Z$/);
	});

	it('lists titles with open flags, most flagged first, and drops closed flags', async () => {
		await db.insert(titleCountFlags).values([
			{ titleId: a, reporterId: 'r1', note: 'Too low' },
			{ titleId: a, reporterId: 'r2' },
			{ titleId: b, reporterId: 'r1' }
		]);
		const flagged = await listFlaggedTitles();
		expect(flagged.map((f) => f.titleId)).toEqual([a, b]);
		expect(flagged[0].flags.map((f) => f.note)).toEqual(expect.arrayContaining([null, 'Too low']));
		await resolveCountFlag(flagged[1].flags[0].id, 'mod');
		expect((await listFlaggedTitles()).map((f) => f.titleId)).toEqual([a]);
	});
});
