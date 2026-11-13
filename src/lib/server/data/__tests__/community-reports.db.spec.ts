import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { titleUm, umSource } from '#db/schema/sources.ts';
import { communityContentReports } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	deleteReport,
	getReportCounts,
	getViewerReport,
	ReportAnswersError,
	upsertReport,
	type ReportAnswers
} from '#lib/server/data/community-reports.ts';
import { getUserRatings } from '#lib/server/data/user-queries.ts';
import type { TitleRef } from '#lib/server/data/title-queries.ts';
import {
	BURST_COUNT,
	BURST_WINDOW_HOURS,
	NEW_ACCOUNT_REPORT_MAX,
	REPORT_ACCOUNT_MIN_AGE_DAYS
} from '#lib/media/utils/communityReports.ts';

const DAY = 86_400_000;
const REF: TitleRef = { title: 'Alien', imdbId: null, tmdbId: '348', releaseDate: '1979-05-25' };

const asUser = (id: string) => ({ id, role: 'user' });
const MOD = { id: 'mod', role: 'moderator' };
const ADMIN = { id: 'admin', role: 'administrator' };

const answers = (over: Partial<ReportAnswers> = {}): ReportAnswers => ({
	sexualPresent: null,
	partnerLevel: 'on_screen',
	physicalLevel: 'mentioned',
	stalkingLevel: null,
	objectificationLevel: 'some_scenes',
	flags: {},
	framing: 'condemned',
	...over
});

async function addUser(id: string, ageDays = 100, over: Partial<typeof users.$inferInsert> = {}) {
	const created = new Date(Date.now() - ageDays * DAY);
	await db
		.insert(users)
		.values(userValues(id, { createdAt: created, updatedAt: created, ...over }));
}

let titleId: string;
beforeEach(async () => {
	await addUser('reader');
	const [t] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = t.id;
});

describe('upsertReport', () => {
	it('stores a counted report and overwrites it on a second call', async () => {
		const first = await upsertReport(asUser('reader'), 'movie', REF, answers());
		expect(first.status).toBe('counted');
		expect(first.title.id).toBe(titleId);
		await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ partnerLevel: 'none', framing: null })
		);
		const rows = await db.select().from(communityContentReports);
		expect(rows).toHaveLength(1);
		expect(rows[0].partnerLevel).toBe('none');
		expect(rows[0].framing).toBeNull();
	});

	it('creates the title row when it is new', async () => {
		const result = await upsertReport(
			asUser('reader'),
			'movie',
			{ ...REF, tmdbId: '999' },
			answers()
		);
		expect(result.title.id).not.toBe(titleId);
		expect(result.title.tmdbId).toBe(999);
	});

	it('keeps the flags only when sexual violence is present', async () => {
		await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ sexualPresent: 'present', flags: { rapeOnScreen: true, incest: false } })
		);
		let [row] = await db.select().from(communityContentReports);
		expect(row.sexualPresent).toBe('present');
		expect(row.rapeOnScreen).toBe(true);
		expect(row.incest).toBe(false);
		expect(row.rapeOffScrn).toBeNull();

		await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ sexualPresent: null, flags: { incest: false } })
		);
		[row] = await db.select().from(communityContentReports);
		expect(row.sexualPresent).toBeNull();
		expect(row.rapeOnScreen).toBeNull();
		expect(row.incest).toBeNull();

		await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ sexualPresent: 'none', flags: { incest: false } })
		);
		[row] = await db.select().from(communityContentReports);
		expect(row.sexualPresent).toBe('none');
		expect(row.incest).toBeNull();
	});

	it('refuses a Yes flag while sexual violence is Not shown, and writes nothing', async () => {
		await expect(
			upsertReport(
				asUser('reader'),
				'movie',
				{ ...REF, tmdbId: '999' },
				answers({ sexualPresent: 'none', flags: { rapeOnScreen: true } })
			)
		).rejects.toBeInstanceOf(ReportAnswersError);
		expect(await db.select().from(communityContentReports)).toHaveLength(0);
		expect(await db.select().from(titles)).toHaveLength(1);
	});

	it('runs the rules again on an edit', async () => {
		const [um] = await db
			.insert(umSource)
			.values({
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
			})
			.returning();
		await db.insert(titleUm).values({ titleId, umId: um.umId });

		const held = await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ sexualPresent: 'none' })
		);
		expect(held).toMatchObject({ status: 'held', holdReason: 'contradicts_source' });
		const fixed = await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ sexualPresent: 'present' })
		);
		expect(fixed).toMatchObject({ status: 'counted', holdReason: null });
	});

	it('holds the report that makes a burst, and an edit of a report inside the window does not count itself', async () => {
		for (let i = 0; i < BURST_COUNT - 1; i++) {
			await addUser(`b${i}`);
			expect((await upsertReport(asUser(`b${i}`), 'movie', REF, answers())).status).toBe('counted');
		}
		const burst = await upsertReport(asUser('reader'), 'movie', REF, answers());
		expect(burst).toMatchObject({ status: 'held', holdReason: 'burst' });
		const again = await upsertReport(asUser('b0'), 'movie', REF, answers({ framing: null }));
		expect(again.status).toBe('held');
	});

	it('does not hold an edit of a report created outside the burst window as a burst', async () => {
		for (let i = 0; i < BURST_COUNT - 1; i++) {
			await addUser(`b${i}`);
			await upsertReport(asUser(`b${i}`), 'movie', REF, answers());
		}
		const old = new Date(Date.now() - (BURST_WINDOW_HOURS + 1) * 3_600_000);
		await db
			.insert(communityContentReports)
			.values({ userId: 'reader', titleId, createdAt: old, updatedAt: old });
		const edited = await upsertReport(asUser('reader'), 'movie', REF, answers({ framing: null }));
		expect(edited).toMatchObject({ status: 'counted', holdReason: null });
	});

	it('holds a busy new account', async () => {
		await addUser('fresh', 2);
		for (let i = 0; i < NEW_ACCOUNT_REPORT_MAX; i++) {
			const [t] = await db
				.insert(titles)
				.values({ kind: 'movie', title: `T${i}`, cleanTitle: `t${i}`, tmdbId: 5000 + i })
				.returning();
			await db.insert(communityContentReports).values({ userId: 'fresh', titleId: t.id });
		}
		const result = await upsertReport(asUser('fresh'), 'movie', REF, answers());
		expect(result).toMatchObject({ status: 'held', holdReason: 'busy_new_account' });
	});

	it('keeps a rejected report rejected', async () => {
		await upsertReport(asUser('reader'), 'movie', REF, answers());
		await db.update(communityContentReports).set({ status: 'rejected' });
		const result = await upsertReport(
			asUser('reader'),
			'movie',
			REF,
			answers({ partnerLevel: 'none' })
		);
		expect(result).toMatchObject({ status: 'rejected', holdReason: null });
	});
});

describe('staff reports', () => {
	const addStaff = (id: string, role: 'moderator' | 'administrator' = 'moderator') =>
		addUser(id, 1, { role });

	it('counts a young moderator’s report at once, with no hold', async () => {
		await addStaff('mod');
		const result = await upsertReport(MOD, 'movie', REF, answers());
		expect(result).toMatchObject({ status: 'counted', holdReason: null });
		expect((await getReportCounts(titleId)).total).toBe(1);
		const viewer = await getViewerReport('mod', titleId);
		expect(viewer?.countsFrom.getTime()).toBeLessThanOrEqual(Date.now());
		expect((await getUserRatings('mod'))[0].countsFrom.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it('never holds a staff report under a burst', async () => {
		for (let i = 0; i < BURST_COUNT - 1; i++) {
			await addUser(`b${i}`);
			await upsertReport(asUser(`b${i}`), 'movie', REF, answers());
		}
		await addStaff('admin', 'administrator');
		expect(await upsertReport(ADMIN, 'movie', REF, answers())).toMatchObject({
			status: 'counted',
			holdReason: null
		});
	});

	it('never holds a staff report that contradicts the title’s UM entry', async () => {
		const [um] = await db
			.insert(umSource)
			.values({
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
			})
			.returning();
		await db.insert(titleUm).values({ titleId, umId: um.umId });
		await addStaff('mod');
		expect(await upsertReport(MOD, 'movie', REF, answers({ sexualPresent: 'none' }))).toMatchObject(
			{ status: 'counted', holdReason: null }
		);
	});

	it('still holds a young user’s report from the wait, and leaves it out of the counts', async () => {
		await addUser('young', 1);
		await upsertReport(asUser('young'), 'movie', REF, answers());
		expect((await getReportCounts(titleId)).total).toBe(0);
		expect((await getViewerReport('young', titleId))?.countsFrom.getTime()).toBeGreaterThan(
			Date.now()
		);
	});

	it('keeps a rejected staff report rejected on edit, and out of the counts', async () => {
		await addStaff('mod');
		await upsertReport(MOD, 'movie', REF, answers());
		await db.update(communityContentReports).set({ status: 'rejected' });
		const result = await upsertReport(MOD, 'movie', REF, answers({ partnerLevel: 'none' }));
		expect(result).toMatchObject({ status: 'rejected', holdReason: null });
		expect((await getReportCounts(titleId)).total).toBe(0);
	});

	it('leaves a muted or banned staff account out of the counts', async () => {
		await addUser('mmod', 1, { role: 'moderator', mutedUntil: new Date(Date.now() + DAY) });
		await addUser('bmod', 1, { role: 'moderator', bannedAt: new Date() });
		await db.insert(communityContentReports).values([
			{ userId: 'mmod', titleId },
			{ userId: 'bmod', titleId }
		]);
		expect((await getReportCounts(titleId)).total).toBe(0);
	});
});

describe('deleteReport and getViewerReport', () => {
	it('deletes the community report, and reports whether there was one', async () => {
		await upsertReport(asUser('reader'), 'movie', REF, answers());
		expect(await deleteReport('reader', titleId)).toBe(true);
		expect(await deleteReport('reader', titleId)).toBe(false);
		expect(await getViewerReport('reader', titleId)).toBeNull();
	});

	it('returns the status and the date the report starts counting', async () => {
		await addUser('young', 2);
		await upsertReport(asUser('young'), 'movie', REF, answers());
		const report = await getViewerReport('young', titleId);
		expect(report?.status).toBe('counted');
		const [u] = await db.select().from(users).where(eq(users.id, 'young'));
		expect(report?.countsFrom.getTime()).toBe(
			u.createdAt.getTime() + REPORT_ACCOUNT_MIN_AGE_DAYS * DAY
		);
	});
});

describe('getReportCounts', () => {
	async function report(userId: string, over: Partial<ReportAnswers> = {}) {
		await upsertReport(asUser(userId), 'movie', REF, answers(over));
	}

	it('counts levels, flags and framing of counted reports', async () => {
		await addUser('a');
		await report('reader', {
			sexualPresent: 'present',
			flags: { rapeOnScreen: true, incest: false }
		});
		await report('a', { partnerLevel: null, framing: null });
		const counts = await getReportCounts(titleId);
		expect(counts.total).toBe(2);
		expect(counts.categories.partner).toEqual({ none: 0, mentioned: 0, on_screen: 1, unsure: 1 });
		expect(counts.categories.sexual).toEqual({ none: 0, present: 1, unsure: 1 });
		expect(counts.categories.objectification.some_scenes).toBe(2);
		expect(counts.flags.rapeOnScreen).toEqual({ yes: 1, no: 0, unsure: 0 });
		expect(counts.flags.incest).toEqual({ yes: 0, no: 1, unsure: 0 });
		expect(counts.framing.condemned).toBe(1);
	});

	it('tallies flags only over reports that said sexual violence is present', async () => {
		await addUser('a');
		await addUser('b');
		await addUser('c');
		await report('reader', { sexualPresent: 'present', flags: { incest: true } });
		await report('a', { sexualPresent: 'none' });
		await report('b', { sexualPresent: null });
		await report('c', { sexualPresent: 'present', flags: {} });
		const { flags } = await getReportCounts(titleId);
		expect(flags.incest).toEqual({ yes: 1, no: 0, unsure: 1 });
		expect(flags.rapeOnScreen).toEqual({ yes: 0, no: 0, unsure: 2 });
	});

	it('is empty for a title nobody reported', async () => {
		const counts = await getReportCounts(titleId);
		expect(counts.total).toBe(0);
		expect(counts.categories.sexual.present).toBe(0);
	});

	it('leaves out held, rejected, under-age, muted and banned reports', async () => {
		await addUser('young', REPORT_ACCOUNT_MIN_AGE_DAYS - 1);
		await addUser('muted', 100, { mutedUntil: new Date(Date.now() + DAY) });
		await addUser('banned', 100, { bannedAt: new Date() });
		await addUser('held');
		await addUser('rejected');
		await addUser('lapsed', 100, { mutedUntil: new Date(Date.now() - DAY) });
		// Inserted directly: seven reports in the window would trip the burst rule on write.
		const ids = ['reader', 'young', 'muted', 'banned', 'held', 'rejected', 'lapsed'];
		await db.insert(communityContentReports).values(ids.map((userId) => ({ userId, titleId })));
		await db
			.update(communityContentReports)
			.set({ status: 'held', holdReason: 'burst' })
			.where(eq(communityContentReports.userId, 'held'));
		await db
			.update(communityContentReports)
			.set({ status: 'rejected' })
			.where(eq(communityContentReports.userId, 'rejected'));
		expect((await getReportCounts(titleId)).total).toBe(2);
	});

	it('counts a young account once it comes of age', async () => {
		await addUser('young', REPORT_ACCOUNT_MIN_AGE_DAYS - 1);
		await report('young');
		expect((await getReportCounts(titleId)).total).toBe(0);
		const aged = new Date(Date.now() - (REPORT_ACCOUNT_MIN_AGE_DAYS + 1) * DAY);
		await db.update(users).set({ createdAt: aged }).where(eq(users.id, 'young'));
		expect((await getReportCounts(titleId)).total).toBe(1);
	});
});

describe('getUserRatings', () => {
	it('gives a young account its counts-from date and flags a muted or banned one', async () => {
		await addUser('young', 2);
		await addUser('muted', 100, { mutedUntil: new Date(Date.now() + DAY) });
		await addUser('banned', 100, { bannedAt: new Date() });
		for (const id of ['young', 'muted', 'banned'])
			await upsertReport(asUser(id), 'movie', REF, answers());
		const [young] = await getUserRatings('young');
		expect(young.countsFrom.getTime()).toBeGreaterThan(Date.now());
		expect(young.restricted).toBeNull();
		expect((await getUserRatings('muted'))[0].restricted).toBe('muted');
		expect((await getUserRatings('banned'))[0].restricted).toBe('banned');
	});

	it('lists the community reports with their status, newest first', async () => {
		await upsertReport(asUser('reader'), 'movie', REF, answers());
		const rows = await getUserRatings('reader');
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ status: 'counted', title: 'Alien', kind: 'movie' });
		expect(rows[0].countsFrom.getTime()).toBeLessThan(Date.now());
		expect(rows[0].restricted).toBeNull();
		expect(await getUserRatings('nobody')).toEqual([]);
	});
});
