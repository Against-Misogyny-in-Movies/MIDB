import { error } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const rateLimit = vi.fn();
const purgeTitleComments = vi.fn();
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
const flags = { resolveCountFlag: vi.fn(), dismissCountFlag: vi.fn() };
const getSourceSyncDates = vi.fn();

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	rateLimit: (...args: unknown[]) => rateLimit(...args)
}));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeTitleComments: (...args: unknown[]) => purgeTitleComments(...args)
}));
vi.mock('#lib/server/data/moderation-actions.ts', () => queries);
vi.mock('#lib/server/data/moderation-queue.ts', () => queries);
vi.mock('#lib/server/data/reader-report-moderation.ts', () => reports);
vi.mock('#lib/server/data/count-flags.ts', () => flags);
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
	'dismissFlag'
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
	fields: Record<string, string> = { id: 'c1', userId: 'u1', titleId: 't1', hours: '24' }
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
	purgeTitleComments.mockReset();
	for (const fn of Object.values(queries))
		fn.mockReset().mockResolvedValue({ ok: true, title: TITLE });
	for (const fn of Object.values(reports))
		fn.mockReset().mockResolvedValue({ ok: true, titles: [] });
	for (const fn of Object.values(flags)) fn.mockReset().mockResolvedValue(true);
	reports.listHeldReports.mockResolvedValue([]);
	reports.listFlaggedTitles.mockResolvedValue([]);
	reports.getOpenTitle.mockResolvedValue(null);
	getSourceSyncDates.mockReset().mockResolvedValue({});
});

describe('load', () => {
	it('requires a moderator or administrator, as a page', async () => {
		queries.listPendingQueue.mockResolvedValue([]);
		queries.listReportedQueue.mockResolvedValue([]);
		queries.listRecentActions.mockResolvedValue([]);
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

	it('returns the queues and the daily sources that went stale', async () => {
		queries.listPendingQueue.mockResolvedValue([{ id: 'p' }]);
		queries.listReportedQueue.mockResolvedValue([{ id: 'r' }]);
		queries.listRecentActions.mockResolvedValue([{ id: 'a' }]);
		getSourceSyncDates.mockResolvedValue({
			um: new Date(Date.now() - 49 * 3_600_000).toISOString(),
			bechdel: new Date().toISOString()
		});
		const data = (await load(loadEvent())) as {
			pending: unknown[];
			staleSources: { source: string }[];
		};
		expect(data.pending).toEqual([{ id: 'p' }]);
		expect(data.staleSources.map((s) => s.source)).toEqual(['um']);
	});
});

describe.each([...NAMES, ...REPORT_NAMES])('?/%s', (name) => {
	it('answers 403 to a reader who is not a moderator and changes nothing', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(run(name)).rejects.toMatchObject({ status: 403 });
		for (const fn of allFns()) expect(fn).not.toHaveBeenCalled();
		expect(purgeTitleComments).not.toHaveBeenCalled();
	});

	it('answers 401 to a signed-out reader', async () => {
		requireRole.mockImplementation(async () => error(401, 'Unauthorized'));
		await expect(run(name)).rejects.toMatchObject({ status: 401 });
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it('calls the guard for staff, without a page redirect, then the rate limit with the user', async () => {
		await run(name);
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator']);
		expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_MODERATE', { userId: 'mod-1' });
	});

	it('answers 429 from the rate limit before any change', async () => {
		rateLimit.mockImplementation(async () => error(429, 'Too many requests'));
		await expect(run(name)).rejects.toMatchObject({ status: 429 });
		for (const fn of allFns()) expect(fn).not.toHaveBeenCalled();
	});
});

describe('the reader-reports view', () => {
	it('returns the held reports, the flagged titles and no open title without ?title=', async () => {
		reports.listHeldReports.mockResolvedValue([{ titleId: 't1' }]);
		reports.listFlaggedTitles.mockResolvedValue([{ titleId: 't2' }]);
		const data = (await load(loadEvent())) as Record<string, unknown>;
		expect(data.held).toEqual([{ titleId: 't1' }]);
		expect(data.flagged).toEqual([{ titleId: 't2' }]);
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

describe('reader-report actions', () => {
	it('count and reject call the data function with the actor, account and title', async () => {
		expect(await run('countReport', REPORT_FIELDS)).toEqual({ id: 'u1:t1', done: 'countReport' });
		expect(reports.approveReport).toHaveBeenCalledWith(MOD, 'u1', 't1');
		await run('rejectReport', REPORT_FIELDS);
		expect(reports.rejectReport).toHaveBeenCalledWith(MOD, 'u1', 't1');
		expect(purgeTitleComments).not.toHaveBeenCalled();
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
		expect(flags.resolveCountFlag).toHaveBeenCalledWith('f1', 'mod-1');
		await run('dismissFlag', REPORT_FIELDS);
		expect(flags.dismissCountFlag).toHaveBeenCalledWith('f1', 'mod-1');
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
		flags.resolveCountFlag.mockResolvedValue(false);
		expect(await run('resolveFlag', REPORT_FIELDS)).toMatchObject({ status: 409 });
	});
});

describe('purging', () => {
	it.each(['approve', 'hide', 'reject', 'restore', 'dismiss'] as const)(
		'%s purges the title’s comment list',
		async (name) => {
			const result = await run(name);
			expect(result).toEqual({ id: 'c1', done: name });
			expect(purgeTitleComments).toHaveBeenCalledExactlyOnceWith(TITLE);
		}
	);

	it('a refused action purges nothing and says why', async () => {
		queries.approveComment.mockResolvedValue({ ok: false, reason: 'invalid-state' });
		const result = await run('approve');
		expect(result).toMatchObject({ status: 409, data: { id: 'c1' } });
		expect(purgeTitleComments).not.toHaveBeenCalled();
	});

	it('mute and ban touch no list', async () => {
		queries.muteUser.mockResolvedValue({ ok: true, title: null });
		queries.banAccount.mockResolvedValue({ ok: true, title: null });
		expect(await run('mute')).toEqual({ id: 'c1', done: 'mute' });
		expect(await run('ban')).toEqual({ id: 'c1', done: 'ban' });
		expect(purgeTitleComments).not.toHaveBeenCalled();
	});
});

describe('inputs', () => {
	it('trims a reason and keeps it to the limit', async () => {
		await run('reject', { id: 'c1', reason: `  ${'x'.repeat(300)}  ` });
		expect(queries.rejectComment).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'mod-1' }),
			'c1',
			'x'.repeat(140)
		);
	});

	it('passes no reason when the field is empty', async () => {
		await run('hide', { id: 'c1', reason: '   ' });
		expect(queries.hideComment).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'mod-1' }),
			'c1',
			null
		);
	});

	it('mutes for a listed length only', async () => {
		await run('mute', { id: 'c1', userId: 'u1', hours: '168' });
		const [actor, userId, hours] = queries.muteUser.mock.calls[0];
		expect(actor).toBe(MOD);
		expect(userId).toBe('u1');
		expect(hours).toBe(168);

		queries.muteUser.mockClear();
		const result = await run('mute', { id: 'c1', userId: 'u1', hours: '5' });
		expect(result).toMatchObject({ status: 400 });
		expect(queries.muteUser).not.toHaveBeenCalled();
	});

	it('answers 400 when the request names no target', async () => {
		expect(await run('approve', {})).toMatchObject({ status: 400 });
		expect(queries.approveComment).not.toHaveBeenCalled();
	});

	it('a ban passes the acting user and the account', async () => {
		await run('ban', { id: 'c1', userId: 'u1', reason: 'Slurs' });
		expect(queries.banAccount).toHaveBeenCalledWith(MOD, 'u1', 'Slurs');
	});

	it('maps a forbidden target to 403 with a message for the row', async () => {
		queries.banAccount.mockResolvedValue({ ok: false, reason: 'forbidden-target' });
		expect(await run('ban')).toMatchObject({ status: 403, data: { id: 'c1' } });
	});
});
