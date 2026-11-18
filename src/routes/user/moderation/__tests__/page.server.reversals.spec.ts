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
const reversals = { unmuteUser: vi.fn(), unbanAccount: vi.fn() };
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
vi.mock('#lib/server/data/moderation-reversals.ts', () => reversals);
vi.mock('#lib/server/data/moderation-counts.ts', () => ({
	getModerationCounts: () => getModerationCounts()
}));
vi.mock('#lib/server/data/source-sync.ts', () => ({
	getSourceSyncDates: () => getSourceSyncDates()
}));

const { actions } = await import('../+page.server');

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
const REVERSAL_NAMES = ['unmute', 'unban'] as const;
type Name =
	| (typeof NAMES)[number]
	| (typeof REPORT_NAMES)[number]
	| (typeof REVERSAL_NAMES)[number];

const REPORT_FIELDS = { id: 'f1', userId: 'u1', titleId: 't1' };
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
	for (const fn of Object.values(reversals))
		fn.mockReset().mockResolvedValue({ ok: true, title: null, purge: { profiles: ['u1'] } });
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

describe('the rule', () => {
	it.each(['hide', 'reject', 'mute', 'ban'] as const)(
		'%s without a rule, or with one outside the list, is invalid and changes nothing',
		async (name) => {
			const fields = { id: 'c1', userId: 'u1', hours: '24' };
			expect(await run(name, fields)).toMatchObject({ status: 400, data: { id: 'c1' } });
			expect(await run(name, { ...fields, rule: 'bogus' })).toMatchObject({ status: 400 });
			expect(await run(name, { ...fields, rule: '' })).toMatchObject({ status: 400 });
			for (const fn of [
				queries.hideComment,
				queries.rejectComment,
				queries.muteUser,
				queries.banAccount
			]) {
				expect(fn).not.toHaveBeenCalled();
			}
			expect(purgeProfiles).not.toHaveBeenCalled();
		}
	);

	it('hide and reject pass the rule after the reason', async () => {
		await run('hide', { id: 'c1', rule: 'trolling' });
		expect(queries.hideComment).toHaveBeenCalledWith(MOD, 'c1', null, 'trolling');
		await run('reject', { id: 'c1', rule: 'other', reason: 'Why' });
		expect(queries.rejectComment).toHaveBeenCalledWith(MOD, 'c1', 'Why', 'other');
	});

	it('approve, restore and dismiss take no rule', async () => {
		await run('approve', { id: 'c1', editedAt: '' });
		expect(queries.approveComment).toHaveBeenCalledOnce();
	});
});

describe('reversals', () => {
	it('unmute and unban call the data function with the account and the reason', async () => {
		expect(await run('unmute', { id: 'c1', userId: 'u1', reason: ' mistake ' })).toEqual({
			id: 'c1',
			done: 'unmute'
		});
		expect(reversals.unmuteUser).toHaveBeenCalledWith(MOD, 'u1', 'mistake');
		expect(await run('unban', { userId: 'u1' })).toEqual({ id: 'u1', done: 'unban' });
		expect(reversals.unbanAccount).toHaveBeenCalledWith(MOD, 'u1', null);
	});

	it('purges the profile and the counts their result names, and touches no comment list', async () => {
		await run('unmute');
		await run('unban');
		expect(purgeProfiles).toHaveBeenCalledTimes(2);
		expect(purgeProfiles).toHaveBeenCalledWith(['u1']);
		expect(purgeTitlesComments).not.toHaveBeenCalled();
	});

	it.each([
		['unmute', 'unmuteUser', 'not-muted', 409, 'This account is not muted.'],
		['unban', 'unbanAccount', 'not-banned', 409, 'This account is not banned.'],
		['unban', 'unbanAccount', 'admin-only', 403, 'Only an administrator can lift a ban.'],
		[
			'unmute',
			'unmuteUser',
			'admin-acted',
			403,
			'An administrator acted on this last, so only an administrator can act on it again.'
		]
	] as const)(
		'%s refused as %s answers %i with a toast message',
		async (name, fn, reason, status, message) => {
			reversals[fn].mockResolvedValue({ ok: false, reason });
			const result = await run(name);
			expect(result).toMatchObject({ status, data: { id: 'c1', error: message } });
			expect(purgeProfiles).not.toHaveBeenCalled();
		}
	);

	it('refuses a request without a target', async () => {
		expect(await run('unmute', {})).toMatchObject({ status: 400 });
		expect(reversals.unmuteUser).not.toHaveBeenCalled();
	});

	it('reopenFlag re-opens the flag as the acting staff member and purges nothing', async () => {
		expect(await run('reopenFlag', REPORT_FIELDS)).toEqual({ id: 'f1', done: 'reopenFlag' });
		expect(flags.reopenCountFlag).toHaveBeenCalledWith('f1', MOD);
		flags.reopenCountFlag.mockResolvedValue({ ok: false, reason: 'own-flag' });
		expect(await run('reopenFlag', REPORT_FIELDS)).toMatchObject({ status: 403 });
		expect(purgeTitlesReports).not.toHaveBeenCalled();
		expect(purgeProfiles).not.toHaveBeenCalled();
	});
});
