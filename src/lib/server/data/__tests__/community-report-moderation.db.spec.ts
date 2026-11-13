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
import { REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import { userValues } from '#db/test/users.ts';
import {
	approveReport,
	rejectAccountReports,
	rejectReport
} from '#lib/server/data/community-report-moderation.ts';
import {
	getOpenTitle,
	listFlaggedTitles,
	listHeldReports,
	listTitleReports
} from '#lib/server/data/community-report-queue.ts';
import { banAccount, muteUser } from '#lib/server/data/moderation-actions.ts';
import { dismissCountFlag, resolveCountFlag } from '#lib/server/data/count-flags.ts';
import { listRecentActions } from '#lib/server/data/moderation-queue.ts';
import { getReportCounts } from '#lib/server/data/community-reports.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

const purged = vi.hoisted(() => vi.fn());
const purgedMany = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeTitleReports: purged,
	purgeTitlesReports: purgedMany,
	purgeProfile: vi.fn()
}));

const DAY = 86_400_000;
let mod: UserRow;
let a: string;
let b: string;

beforeEach(async () => {
	purged.mockClear();
	purgedMany.mockClear();
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
		expect(purgedMany).toHaveBeenCalledTimes(1);
		expect(purgedMany.mock.calls[0][0]).toHaveLength(2);
		expect(await onScreen(a)).toBe(1);
	});

	it('refuses an unknown account and one with nothing left to reject', async () => {
		expect(await rejectAccountReports(mod, 'nobody')).toEqual({ ok: false, reason: 'not-found' });
		await report('r1', a, 'rejected');
		expect(await rejectAccountReports(mod, 'r1')).toEqual({ ok: false, reason: 'invalid-state' });
		expect(await log()).toHaveLength(0);
	});
});

describe('who may be acted on', () => {
	it('refuses a moderator acting on their own report or an administrator’s, changing nothing', async () => {
		await db.insert(users).values(userValues('boss', { role: 'administrator' }));
		await report('mod', a);
		await report('boss', a);
		for (const id of ['mod', 'boss']) {
			expect(await rejectReport(mod, id, a)).toEqual({ ok: false, reason: 'forbidden-target' });
			expect(await approveReport(mod, id, a)).toEqual({ ok: false, reason: 'forbidden-target' });
			expect(await rejectAccountReports(mod, id)).toEqual({
				ok: false,
				reason: 'forbidden-target'
			});
		}
		expect((await statusOf('mod', a)).status).toBe('counted');
		expect(await log()).toHaveLength(0);
		expect(purged).not.toHaveBeenCalled();
		expect(purgedMany).not.toHaveBeenCalled();
	});

	it('lets only an administrator act on a moderator’s reports', async () => {
		await db.insert(users).values(userValues('mod2', { role: 'moderator' }));
		await report('mod2', a);
		expect(await rejectReport(mod, 'mod2', a)).toEqual({ ok: false, reason: 'forbidden-target' });
		const [admin] = await db
			.insert(users)
			.values(userValues('boss', { role: 'administrator' }))
			.returning();
		expect((await rejectReport(admin, 'mod2', a)).ok).toBe(true);
	});

	it('lets an administrator act on an administrator’s reports and their own', async () => {
		const [admin] = await db
			.insert(users)
			.values(userValues('boss', { role: 'administrator' }))
			.returning();
		await db.insert(users).values(userValues('boss2', { role: 'administrator' }));
		await report('boss2', a);
		await report('boss', b);
		expect((await rejectReport(admin, 'boss2', a)).ok).toBe(true);
		expect((await rejectReport(admin, 'boss', b)).ok).toBe(true);
	});
});

describe('mute and ban purge the counts of every reported title', () => {
	it('purges both titles on a mute, and the counts drop the account', async () => {
		await report('r1', a);
		await report('r1', b, 'held', 'busy_new_account');
		await muteUser(mod, 'r1', 24, null);
		expect(purgedMany).toHaveBeenCalledTimes(1);
		expect(purgedMany.mock.calls[0][0]).toHaveLength(2);
		expect(await onScreen(a)).toBe(0);
	});

	it('purges both titles on a ban', async () => {
		await report('r1', a);
		await report('r1', b);
		await banAccount(mod, 'r1', null);
		expect(purgedMany.mock.calls[0][0]).toHaveLength(2);
	});

	it('purges nothing for an account with no reports', async () => {
		await muteUser(mod, 'r2', 24, null);
		expect(purged).not.toHaveBeenCalled();
		expect(purgedMany.mock.calls.flatMap((c) => c[0])).toHaveLength(0);
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
		expect(await resolveCountFlag(f1.id, mod)).toEqual({ ok: true });
		expect(await dismissCountFlag(f2.id, mod)).toEqual({ ok: true });
		expect(await resolveCountFlag(f1.id, mod)).toEqual({ ok: false, reason: 'invalid-state' });
		const rows = (await log()).map((r) => [r.action, r.targetTitleId, r.actorId]).sort();
		expect(rows).toEqual([
			['dismiss_count_flag', b, 'mod'],
			['resolve_count_flag', a, 'mod']
		]);
		expect(purged).not.toHaveBeenCalled();
	});

	it('writes no log row for a missing flag', async () => {
		expect(await resolveCountFlag('nope', mod)).toEqual({ ok: false, reason: 'not-found' });
		expect(await log()).toHaveLength(0);
	});
});

describe('the action log', () => {
	it('names the title of a report action and of a count-flag action, not of a whole-account one', async () => {
		await report('r1', a);
		await report('r1', b);
		const [flag] = await db
			.insert(titleCountFlags)
			.values({ titleId: b, reporterId: 'r2' })
			.returning();
		await rejectReport(mod, 'r1', a);
		await resolveCountFlag(flag.id, mod);
		await rejectAccountReports(mod, 'r1');
		const byAction = new Map((await listRecentActions()).map((e) => [e.action, e.title]));
		expect(byAction.get('reject_report')).toMatchObject({ id: a, name: 'Alien' });
		expect(byAction.get('resolve_count_flag')).toMatchObject({ id: b, name: 'Dark' });
		expect(byAction.get('reject_account_reports')).toBeNull();
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
		await resolveCountFlag(flagged[1].flags[0].id, mod);
		expect((await listFlaggedTitles()).map((f) => f.titleId)).toEqual([a]);
	});
});

describe('account facts', () => {
	it('reports the role, when reports start to count and why an account is left out', async () => {
		await db
			.update(users)
			.set({ mutedUntil: new Date(Date.now() + DAY) })
			.where(eq(users.id, 'r1'));
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'r2'));
		await report('r1', a);
		await report('r2', a);
		const list = await listTitleReports(a);
		const byId = new Map(list.map((r) => [r.account.userId, r.account]));
		expect(byId.get('r1')).toMatchObject({ role: 'user', restricted: 'muted' });
		expect(byId.get('r2')).toMatchObject({ restricted: 'banned' });
		const created = Date.now() - 100 * DAY;
		expect(
			Math.abs(
				Date.parse(byId.get('r1')!.countsFrom) - (created + REPORT_ACCOUNT_MIN_AGE_DAYS * DAY)
			)
		).toBeLessThan(DAY);
	});

	it('reads accounts past one statement’s parameter limit', async () => {
		const old = new Date(Date.now() - 100 * DAY);
		for (let i = 0; i < 105; i++) {
			await db.insert(users).values(userValues(`bulk${i}`, { createdAt: old, updatedAt: old }));
			await report(`bulk${i}`, a);
		}
		expect(await listTitleReports(a)).toHaveLength(105);
	});

	it('gives the title view UM’s flags on a contradicts_source report', async () => {
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
		await report('r2', a);
		const list = await listTitleReports(a);
		expect(list.find((r) => r.account.userId === 'r1')?.um).toMatchObject({ rapeOnScreen: true });
		expect(list.find((r) => r.account.userId === 'r2')?.um).toBeNull();
	});
});

describe('getOpenTitle', () => {
	it('returns the title with every report on it', async () => {
		await report('r1', a, 'held', 'busy_new_account');
		await report('r2', a);
		const open = await getOpenTitle(a);
		expect(open).toMatchObject({ id: a, kind: 'movie', tmdbId: 348, name: 'Alien' });
		expect(open?.reports.map((r) => r.status).sort()).toEqual(['counted', 'held']);
	});

	it('returns null for an id no title has', async () => {
		expect(await getOpenTitle('missing')).toBeNull();
	});
});
