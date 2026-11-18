import { error } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const rateLimit = vi.fn();
const purgeTitlesComments = vi.fn();
const purgeProfiles = vi.fn();
const purgeTitlesReports = vi.fn();
const queries = {
	approveComment: vi.fn(),
	hideComment: vi.fn(),
	rejectComment: vi.fn(),
	restoreComment: vi.fn(),
	dismissReports: vi.fn(),
	muteUser: vi.fn(),
	banAccount: vi.fn(),
	listPendingQueue: vi.fn(),
	listReportedQueue: vi.fn(),
	listRecentActions: vi.fn()
};
const reports = {
	approveReport: vi.fn(),
	rejectReport: vi.fn(),
	rejectAccountReports: vi.fn(),
	listHeldReports: vi.fn(),
	listFlaggedTitles: vi.fn(),
	getOpenTitle: vi.fn()
};
const flags = { resolveCountFlag: vi.fn(), dismissCountFlag: vi.fn(), reopenCountFlag: vi.fn() };
const getSourceSyncDates = vi.fn();
const getModerationCounts = vi.fn();

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	rateLimit: (...args: unknown[]) => rateLimit(...args)
}));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeTitlesComments: (...args: unknown[]) => purgeTitlesComments(...args),
	purgeProfiles: (...args: unknown[]) => purgeProfiles(...args),
	purgeTitlesReports: (...args: unknown[]) => purgeTitlesReports(...args)
}));
vi.mock('#lib/server/data/moderation-actions.ts', () => queries);
vi.mock('#lib/server/data/moderation-queue.ts', () => queries);
vi.mock('#lib/server/data/community-report-moderation.ts', () => reports);
vi.mock('#lib/server/data/community-report-queue.ts', () => reports);
vi.mock('#lib/server/data/count-flags.ts', () => flags);
vi.mock('#lib/server/data/moderation-reversals.ts', () => ({}));
vi.mock('#lib/server/data/moderation-counts.ts', () => ({
	getModerationCounts: () => getModerationCounts()
}));
vi.mock('#lib/server/data/source-sync.ts', () => ({
	getSourceSyncDates: () => getSourceSyncDates()
}));

const { load, actions } = await import('../+page.server');

const loadEvent = (search = '') =>
	({ locals: {}, url: new URL(`http://localhost/user/moderation${search}`) }) as Parameters<
		typeof load
	>[0];

const MOD = { id: 'mod-1', role: 'moderator' };
const TITLE = { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' };

const NAMES = ['approve', 'hide', 'reject', 'restore', 'dismiss', 'mute', 'ban'] as const;
const REPORT_NAMES = [
	'countReport',
	'rejectReport',
	'rejectAccountReports',
	'resolveFlag',
	'dismissFlag',
	'reopenFlag'
] as const;
type Name = (typeof NAMES)[number] | (typeof REPORT_NAMES)[number];

const REPORT_FIELDS = { id: 'f1', userId: 'u1', titleId: 't1' };
const allFns = () => [
	...Object.values(queries),
	...Object.values(reports),
	...Object.values(flags)
];

function run(
	name: Name,
	fields: Record<string, string> = {
		id: 'c1',
		userId: 'u1',
		titleId: 't1',
		hours: '24',
		editedAt: '',
		rule: 'spam'
	}
) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	const event = {
		locals: {},
		request: new Request('http://localhost/user/moderation', { method: 'POST', body: form }),
		getClientAddress: () => '203.0.113.7'
	};
	return actions[name](event as unknown as Parameters<(typeof actions)[Name]>[0]);
}

beforeEach(() => {
	requireRole.mockReset().mockResolvedValue(MOD);
	rateLimit.mockReset().mockResolvedValue(undefined);
	purgeTitlesComments.mockReset();
	purgeProfiles.mockReset();
	purgeTitlesReports.mockReset();
	for (const fn of Object.values(queries))
		fn.mockReset().mockResolvedValue({ ok: true, title: TITLE });
	for (const fn of Object.values(reports))
		fn.mockReset().mockResolvedValue({ ok: true, titles: [] });
	for (const fn of Object.values(flags)) fn.mockReset().mockResolvedValue({ ok: true });
	const empty = { items: [], nextCursor: null };
	reports.listHeldReports.mockResolvedValue(empty);
	reports.listFlaggedTitles.mockResolvedValue(empty);
	queries.listPendingQueue.mockResolvedValue(empty);
	queries.listReportedQueue.mockResolvedValue(empty);
	queries.listRecentActions.mockResolvedValue(empty);
	reports.getOpenTitle.mockResolvedValue(null);
	getSourceSyncDates.mockReset().mockResolvedValue({});
	getModerationCounts
		.mockReset()
		.mockResolvedValue({ pending: 0, reported: 0, held: 0, flagged: 0 });
});

describe('load', () => {
	it('requires a moderator or administrator, as a page', async () => {
		await load(loadEvent());
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator'], { page: true });
	});

	it('refuses a reader who is not a moderator before reading any queue', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(load(loadEvent())).rejects.toMatchObject({
			status: 403
		});
		expect(queries.listPendingQueue).not.toHaveBeenCalled();
	});

	it('returns the open list, the counts and the daily sources that went stale', async () => {
		queries.listPendingQueue.mockResolvedValue({ items: [{ id: 'p' }], nextCursor: 'next' });
		getModerationCounts.mockResolvedValue({ pending: 73, reported: 4, held: 2, flagged: 3 });
		getSourceSyncDates.mockResolvedValue({
			um: new Date(Date.now() - 49 * 3_600_000).toISOString(),
			bechdel: new Date().toISOString()
		});
		const data = (await load(loadEvent())) as {
			tab: string;
			pending: unknown;
			counts: unknown;
			staleSources: { source: string }[];
		};
		expect(data.tab).toBe('pending');
		expect(data.pending).toEqual({ items: [{ id: 'p' }], nextCursor: 'next' });
		expect(data.counts).toEqual({ pending: 73, reported: 4, held: 2, flagged: 3 });
		expect(data.staleSources.map((s) => s.source)).toEqual(['um']);
	});
});

describe('the open tab, from the URL', () => {
	const readers = {
		pending: [queries.listPendingQueue],
		reported: [queries.listReportedQueue],
		log: [queries.listRecentActions],
		reports: [reports.listHeldReports, reports.listFlaggedTitles]
	};
	const every = Object.values(readers).flat();

	it.each(Object.entries(readers))('?tab=%s reads only that tab’s lists', async (tab, fns) => {
		await load(loadEvent(`?tab=${tab}`));
		for (const fn of fns) expect(fn).toHaveBeenCalledOnce();
		for (const fn of every.filter((f) => !fns.includes(f))) expect(fn).not.toHaveBeenCalled();
		expect(getModerationCounts).toHaveBeenCalledOnce();
		expect(getSourceSyncDates).toHaveBeenCalledOnce();
		const data = (await load(loadEvent(`?tab=${tab}`))) as { tab: string };
		expect(data.tab).toBe(tab);
	});

	it('opens Pending without a tab, and for a tab it does not know', async () => {
		for (const search of ['', '?tab=nonsense']) {
			queries.listPendingQueue.mockClear();
			expect(((await load(loadEvent(search))) as { tab: string }).tab).toBe('pending');
			expect(queries.listPendingQueue).toHaveBeenCalledOnce();
		}
	});

	it('opens the community reports for ?title=, and reads only that title', async () => {
		reports.getOpenTitle.mockResolvedValue({ id: 't9', reports: [], flags: [] });
		const data = (await load(loadEvent('?title=t9'))) as {
			tab: string;
			held: unknown;
			flagged: unknown;
		};
		expect(data.tab).toBe('reports');
		expect(data.held).toBeNull();
		expect(data.flagged).toBeNull();
		expect(reports.listHeldReports).not.toHaveBeenCalled();
		expect(reports.listFlaggedTitles).not.toHaveBeenCalled();
		expect(queries.listPendingQueue).not.toHaveBeenCalled();
	});
});

describe.each([...NAMES, ...REPORT_NAMES])('?/%s', (name) => {
	it('answers 403 to a reader who is not a moderator and changes nothing', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(run(name)).rejects.toMatchObject({ status: 403 });
		for (const fn of allFns()) expect(fn).not.toHaveBeenCalled();
		expect(purgeTitlesComments).not.toHaveBeenCalled();
	});

	it('answers 401 to a signed-out reader', async () => {
		requireRole.mockImplementation(async () => error(401, 'Unauthorized'));
		await expect(run(name)).rejects.toMatchObject({ status: 401 });
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it('calls the guard for staff, without a page redirect, and applies no rate limit', async () => {
		await run(name);
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator']);
		expect(rateLimit).not.toHaveBeenCalled();
	});
});

describe('the community-reports view', () => {
	it('returns the held reports, the flagged titles and no open title without ?title=', async () => {
		const held = { items: [{ titleId: 't1' }], nextCursor: null };
		const flagged = { items: [{ titleId: 't2' }], nextCursor: null };
		reports.listHeldReports.mockResolvedValue(held);
		reports.listFlaggedTitles.mockResolvedValue(flagged);
		const data = (await load(loadEvent('?tab=reports'))) as Record<string, unknown>;
		expect(data.held).toEqual(held);
		expect(data.flagged).toEqual(flagged);
		expect(data.openTitle).toBeNull();
		expect(reports.getOpenTitle).not.toHaveBeenCalled();
	});

	it('opens the title named by ?title=', async () => {
		reports.getOpenTitle.mockResolvedValue({ id: 't9', reports: [] });
		const data = (await load(loadEvent('?title=t9'))) as Record<string, unknown>;
		expect(reports.getOpenTitle).toHaveBeenCalledWith('t9');
		expect(data.openTitle).toEqual({ id: 't9', reports: [] });
	});

	it('reads no report data for a reader who is not staff', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(load(loadEvent('?title=t9'))).rejects.toMatchObject({ status: 403 });
		expect(reports.listHeldReports).not.toHaveBeenCalled();
		expect(reports.getOpenTitle).not.toHaveBeenCalled();
	});
});

describe('community-report actions', () => {
	it('count and reject call the data function with the actor, account and title', async () => {
		expect(await run('countReport', REPORT_FIELDS)).toEqual({ id: 'u1:t1', done: 'countReport' });
		expect(reports.approveReport).toHaveBeenCalledWith(MOD, 'u1', 't1');
		await run('rejectReport', REPORT_FIELDS);
		expect(reports.rejectReport).toHaveBeenCalledWith(MOD, 'u1', 't1');
		expect(purgeTitlesComments).not.toHaveBeenCalled();
	});

	it('reject all calls the data function with the account', async () => {
		expect(await run('rejectAccountReports', REPORT_FIELDS)).toEqual({
			id: 'u1',
			done: 'rejectAccountReports'
		});
		expect(reports.rejectAccountReports).toHaveBeenCalledWith(MOD, 'u1');
	});

	it('resolve and dismiss close the flag as the acting moderator', async () => {
		expect(await run('resolveFlag', REPORT_FIELDS)).toEqual({ id: 'f1', done: 'resolveFlag' });
		expect(flags.resolveCountFlag).toHaveBeenCalledWith('f1', MOD);
		await run('dismissFlag', REPORT_FIELDS);
		expect(flags.dismissCountFlag).toHaveBeenCalledWith('f1', MOD);
	});

	it('answers 400 when the report is not named', async () => {
		expect(await run('countReport', { userId: 'u1' })).toMatchObject({ status: 400 });
		expect(reports.approveReport).not.toHaveBeenCalled();
	});

	it('maps a refusal to its status', async () => {
		reports.approveReport.mockResolvedValue({ ok: false, reason: 'not-found' });
		expect(await run('countReport', REPORT_FIELDS)).toMatchObject({
			status: 404,
			data: { id: 'u1:t1' }
		});
		flags.resolveCountFlag.mockResolvedValue({ ok: false, reason: 'invalid-state' });
		expect(await run('resolveFlag', REPORT_FIELDS)).toMatchObject({ status: 409 });
		flags.dismissCountFlag.mockResolvedValue({ ok: false, reason: 'own-flag' });
		expect(await run('dismissFlag', REPORT_FIELDS)).toMatchObject({
			status: 403,
			data: { error: "A moderator cannot close their own flag or an administrator's." }
		});
	});
});

describe('purging', () => {
	it.each(['approve', 'hide', 'reject', 'restore', 'dismiss'] as const)(
		'%s purges the title’s comment list',
		async (name) => {
			const result = await run(name);
			expect(result).toEqual({ id: 'c1', done: name });
			expect(purgeTitlesComments).toHaveBeenCalledExactlyOnceWith([TITLE]);
		}
	);

	it.each([
		['approve', 'approveComment'],
		['hide', 'hideComment'],
		['reject', 'rejectComment'],
		['restore', 'restoreComment'],
		['dismiss', 'dismissReports']
	] as const)(
		'%s purges the author’s public profile when the result names the author',
		async (name, fn) => {
			queries[fn].mockResolvedValue({
				ok: true,
				title: TITLE,
				authorId: 'author-1'
			});
			await run(name);
			expect(purgeProfiles).toHaveBeenCalledExactlyOnceWith(['author-1']);
		}
	);

	it('purges the profiles of the authors of the published replies with the author’s', async () => {
		queries.hideComment.mockResolvedValue({
			ok: true,
			title: TITLE,
			authorId: 'author-1',
			replyAuthorIds: ['replier-1', 'replier-2']
		});
		await run('hide');
		expect(purgeProfiles).toHaveBeenCalledExactlyOnceWith(['author-1', 'replier-1', 'replier-2']);
	});

	it('a result with no author (a dismiss that restored nothing) purges no profile', async () => {
		await run('dismiss');
		expect(purgeProfiles).not.toHaveBeenCalled();
	});

	it('a refused action purges nothing and says why', async () => {
		queries.approveComment.mockResolvedValue({ ok: false, reason: 'invalid-state' });
		const result = await run('approve');
		expect(result).toMatchObject({ status: 409, data: { id: 'c1' } });
		expect(purgeTitlesComments).not.toHaveBeenCalled();
		expect(purgeProfiles).not.toHaveBeenCalled();
	});

	it.each([
		['edited', 409, /edited after this page loaded/],
		['admin-acted', 403, /administrator acted on this last/]
	] as const)('a %s refusal answers %i with its own message', async (reason, status, message) => {
		queries.approveComment.mockResolvedValue({ ok: false, reason });
		const result = await run('approve');
		expect(result).toMatchObject({ status, data: { id: 'c1' } });
		expect((result as { data: { error: string } }).data.error).toMatch(message);
	});

	it.each([
		['mute', 'muteUser'],
		['ban', 'banAccount']
	] as const)(
		'refuses ?/%s on an account that is already banned, with a toast message',
		async (name, fn) => {
			queries[fn].mockResolvedValue({ ok: false, reason: 'already-banned' });
			const result = await run(name);
			expect(result).toMatchObject({ status: 409, data: { id: 'c1' } });
			expect((result as { data: { error: string } }).data.error).toBe(
				'This account is already banned, so it cannot be banned or muted again.'
			);
			expect(purgeProfiles).not.toHaveBeenCalled();
		}
	);

	it('a hide or reject refused for an administrator’s decision answers 403', async () => {
		queries.hideComment.mockResolvedValue({ ok: false, reason: 'admin-acted' });
		queries.rejectComment.mockResolvedValue({ ok: false, reason: 'admin-acted' });
		for (const name of ['hide', 'reject'] as const) {
			expect(await run(name)).toMatchObject({ status: 403, data: { id: 'c1' } });
		}
	});

	it('mute and ban touch no list and purge the profile their result names', async () => {
		queries.muteUser.mockResolvedValue({ ok: true, title: null, purge: { profiles: ['u1'] } });
		queries.banAccount.mockResolvedValue({ ok: true, title: null, purge: { profiles: ['u1'] } });
		expect(await run('mute')).toEqual({ id: 'c1', done: 'mute' });
		expect(await run('ban')).toEqual({ id: 'c1', done: 'ban' });
		expect(purgeTitlesComments).not.toHaveBeenCalled();
		expect(purgeProfiles).toHaveBeenCalledTimes(2);
		expect(purgeProfiles).toHaveBeenCalledWith(['u1']);
	});

	it.each(['countReport', 'rejectReport'] as const)(
		'%s purges the title counts and the profile its result names',
		async (name) => {
			reports[name === 'countReport' ? 'approveReport' : 'rejectReport'].mockResolvedValue({
				ok: true,
				purge: { reportTitles: [TITLE], profiles: ['u1'] }
			});
			expect(await run(name, REPORT_FIELDS)).toEqual({ id: 'u1:t1', done: name });
			expect(purgeTitlesReports).toHaveBeenCalledExactlyOnceWith([TITLE]);
			expect(purgeProfiles).toHaveBeenCalledExactlyOnceWith(['u1']);
		}
	);

	it('a flag action and a refused report action purge nothing', async () => {
		await run('resolveFlag', REPORT_FIELDS);
		reports.rejectReport.mockResolvedValue({ ok: false, reason: 'invalid-state' });
		await run('rejectReport', REPORT_FIELDS);
		expect(purgeTitlesReports).not.toHaveBeenCalled();
		expect(purgeProfiles).not.toHaveBeenCalled();
	});
});

describe('inputs', () => {
	it('trims a reason and keeps it to the limit', async () => {
		await run('reject', { id: 'c1', rule: 'spam', reason: `  ${'x'.repeat(300)}  ` });
		expect(queries.rejectComment).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'mod-1' }),
			'c1',
			'x'.repeat(140),
			'spam'
		);
	});

	it('passes no reason when the field is empty', async () => {
		await run('hide', { id: 'c1', rule: 'spam', reason: '   ' });
		expect(queries.hideComment).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'mod-1' }),
			'c1',
			null,
			'spam'
		);
	});

	it('mutes for a listed length only', async () => {
		await run('mute', { id: 'c1', userId: 'u1', hours: '168', rule: 'spam' });
		const [actor, userId, hours, , rule] = queries.muteUser.mock.calls[0];
		expect(actor).toBe(MOD);
		expect(userId).toBe('u1');
		expect(hours).toBe(168);
		expect(rule).toBe('spam');

		queries.muteUser.mockClear();
		const result = await run('mute', { id: 'c1', userId: 'u1', hours: '5' });
		expect(result).toMatchObject({ status: 400 });
		expect(queries.muteUser).not.toHaveBeenCalled();
	});

	it('answers 400 when the request names no target', async () => {
		expect(await run('approve', {})).toMatchObject({ status: 400 });
		expect(queries.approveComment).not.toHaveBeenCalled();
	});

	it.each([
		['approve', 'approveComment'],
		['restore', 'restoreComment'],
		['dismiss', 'dismissReports']
	] as const)(
		'%s passes the editedAt the view carried: milliseconds, or null',
		async (name, fn) => {
			await run(name, { id: 'c1', editedAt: '1762077600000' });
			expect(queries[fn]).toHaveBeenLastCalledWith(MOD, 'c1', 1762077600000);
			await run(name, { id: 'c1', editedAt: '' });
			expect(queries[fn]).toHaveBeenLastCalledWith(MOD, 'c1', null);
		}
	);

	it.each(['approve', 'restore', 'dismiss'] as const)(
		'%s without a valid editedAt is refused as invalid, changing nothing',
		async (name) => {
			expect(await run(name, { id: 'c1' })).toMatchObject({ status: 400 });
			expect(await run(name, { id: 'c1', editedAt: 'yesterday' })).toMatchObject({ status: 400 });
			expect(await run(name, { id: 'c1', editedAt: '-5' })).toMatchObject({ status: 400 });
			for (const fn of ['approveComment', 'restoreComment', 'dismissReports'] as const) {
				expect(queries[fn]).not.toHaveBeenCalled();
			}
		}
	);

	it('a ban passes the acting user and the account', async () => {
		await run('ban', { id: 'c1', userId: 'u1', reason: 'Slurs', rule: 'hate' });
		expect(queries.banAccount).toHaveBeenCalledWith(MOD, 'u1', 'Slurs', 'hate');
	});

	it('maps a forbidden target to 403 with a message for the row', async () => {
		queries.banAccount.mockResolvedValue({ ok: false, reason: 'forbidden-target' });
		expect(await run('ban')).toMatchObject({ status: 403, data: { id: 'c1' } });
	});
});
