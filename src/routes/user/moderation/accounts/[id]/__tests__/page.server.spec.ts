import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const rateLimit = vi.fn();
const getAccountView = vi.fn();
const listAccountNotes = vi.fn();
const addAccountNote = vi.fn();
const listAccountComments = vi.fn();
const listAccountReports = vi.fn();
const listReportsAgainst = vi.fn();
const listRecentActions = vi.fn();
const purgeProfiles = vi.fn();
const purgeTitlesReports = vi.fn();
const purgeTitlesComments = vi.fn();
const unmuteUser = vi.fn();

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
vi.mock('#lib/server/data/account-view.ts', () => ({
	getAccountView: (...args: unknown[]) => getAccountView(...args)
}));
vi.mock('#lib/server/data/account-notes.ts', () => ({
	listAccountNotes: (...args: unknown[]) => listAccountNotes(...args),
	addAccountNote: (...args: unknown[]) => addAccountNote(...args)
}));
vi.mock('#lib/server/data/account-lists.ts', () => ({
	listAccountComments: (...args: unknown[]) => listAccountComments(...args),
	listAccountReports: (...args: unknown[]) => listAccountReports(...args),
	listReportsAgainst: (...args: unknown[]) => listReportsAgainst(...args)
}));
vi.mock('#lib/server/data/recent-actions.ts', () => ({
	listRecentActions: (...args: unknown[]) => listRecentActions(...args)
}));
vi.mock('#lib/server/data/moderation-actions.ts', () => ({
	approveComment: vi.fn(),
	hideComment: vi.fn(),
	rejectComment: vi.fn(),
	restoreComment: vi.fn(),
	dismissReports: vi.fn(),
	muteUser: vi.fn(),
	banAccount: vi.fn()
}));
vi.mock('#lib/server/data/community-report-moderation.ts', () => ({
	approveReport: vi.fn(),
	rejectReport: vi.fn(),
	rejectAccountReports: vi.fn()
}));
vi.mock('#lib/server/data/count-flags.ts', () => ({
	resolveCountFlag: vi.fn(),
	dismissCountFlag: vi.fn(),
	reopenCountFlag: vi.fn()
}));
vi.mock('#lib/server/data/moderation-reversals.ts', () => ({
	unmuteUser: (...args: unknown[]) => unmuteUser(...args),
	unbanAccount: vi.fn()
}));

const { load, actions } = await import('../+page.server');

const MOD = { id: 'mod-1', role: 'moderator' };
const loadEvent = (id = 'acct-1') => ({ locals: {}, params: { id } }) as Parameters<typeof load>[0];
const LIVE = { user: { id: 'acct-1', role: 'user' }, deleted: false, figures: {} };

beforeEach(() => {
	for (const fn of [
		requireRole,
		rateLimit,
		getAccountView,
		listAccountNotes,
		addAccountNote,
		listAccountComments,
		listAccountReports,
		listReportsAgainst,
		listRecentActions,
		purgeProfiles,
		purgeTitlesReports,
		purgeTitlesComments,
		unmuteUser
	]) {
		fn.mockReset();
	}
	requireRole.mockResolvedValue(MOD);
	getAccountView.mockResolvedValue(LIVE);
	listRecentActions.mockResolvedValue({ items: [], nextCursor: null });
	listAccountNotes.mockResolvedValue({ notes: [], total: 0 });
	listAccountComments.mockResolvedValue([]);
	listAccountReports.mockResolvedValue([]);
	listReportsAgainst.mockResolvedValue([]);
});

describe('load', () => {
	it('is for staff, with the page redirect for a signed-out visitor', async () => {
		await load(loadEvent());
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator'], { page: true });
	});

	it.each([
		['a signed-out visitor', () => error(401, 'Unauthorized')],
		['a reader who is not staff', () => error(403, 'Forbidden')]
	])('stops %s before reading anything', async (_label, fail) => {
		requireRole.mockImplementation(async () => fail());
		await expect(load(loadEvent())).rejects.toSatisfy((e) => isHttpError(e));
		expect(getAccountView).not.toHaveBeenCalled();
		expect(listRecentActions).not.toHaveBeenCalled();
	});

	it('redirects a signed-out page visit', async () => {
		const { redirect } = await import('@sveltejs/kit');
		requireRole.mockImplementation(async () => redirect(303, '/auth'));
		await expect(load(loadEvent())).rejects.toSatisfy((e) => isRedirect(e));
	});

	it('answers 404 for an unknown account id, reading no list', async () => {
		getAccountView.mockResolvedValue(null);
		await expect(load(loadEvent('nope'))).rejects.toMatchObject({ status: 404 });
		expect(getAccountView).toHaveBeenCalledWith('nope');
		expect(listRecentActions).not.toHaveBeenCalled();
		expect(listAccountNotes).not.toHaveBeenCalled();
	});

	it('reads the log of the account, its notes and its three lists', async () => {
		const data = await load(loadEvent());
		expect(listRecentActions).toHaveBeenCalledWith(null, undefined, { accountId: 'acct-1' });
		expect(listAccountNotes).toHaveBeenCalledWith('acct-1');
		expect(listAccountComments).toHaveBeenCalledWith('acct-1');
		expect(listAccountReports).toHaveBeenCalledWith('acct-1');
		expect(listReportsAgainst).toHaveBeenCalledWith('acct-1');
		expect(data).toMatchObject({ account: LIVE, notes: { total: 0 } });
	});

	it.each([
		['the viewer’s own account', { id: 'mod-1', role: 'moderator' }, MOD],
		['an administrator, for a moderator', { id: 'admin-1', role: 'administrator' }, MOD],
		['another moderator, for a moderator', { id: 'mod-2', role: 'moderator' }, MOD],
		[
			'the viewer’s own account, for an administrator',
			{ id: 'admin-1', role: 'administrator' },
			{ id: 'admin-1', role: 'administrator' }
		]
	])('reads no notes about %s', async (_label, user, viewer) => {
		requireRole.mockResolvedValue(viewer);
		getAccountView.mockResolvedValue({ ...LIVE, user });
		const data = await load(loadEvent(user.id));
		expect(listAccountNotes).not.toHaveBeenCalled();
		expect(data).toMatchObject({ notes: null });
		expect(listRecentActions).toHaveBeenCalledOnce();
		expect(listAccountComments).toHaveBeenCalledOnce();
	});

	it.each([
		['a moderator reading about an ordinary account', MOD, { id: 'acct-1', role: 'user' }],
		[
			'an administrator reading about a moderator',
			{ id: 'admin-1', role: 'administrator' },
			{ id: 'mod-2', role: 'moderator' }
		],
		[
			'an administrator reading about another administrator',
			{ id: 'admin-1', role: 'administrator' },
			{ id: 'admin-2', role: 'administrator' }
		]
	])('reads the notes for %s', async (_label, viewer, user) => {
		requireRole.mockResolvedValue(viewer);
		getAccountView.mockResolvedValue({ ...LIVE, user });
		await load(loadEvent(user.id));
		expect(listAccountNotes).toHaveBeenCalledWith(user.id);
	});

	it('gives a deleted account its log only', async () => {
		getAccountView.mockResolvedValue({ ...LIVE, deleted: true, figures: null });
		const data = await load(loadEvent());
		expect(listRecentActions).toHaveBeenCalledOnce();
		expect(listAccountNotes).not.toHaveBeenCalled();
		expect(listAccountComments).not.toHaveBeenCalled();
		expect(listAccountReports).not.toHaveBeenCalled();
		expect(listReportsAgainst).not.toHaveBeenCalled();
		expect(data).toMatchObject({ notes: null, comments: null, reports: null, against: null });
	});
});

describe('actions', () => {
	const event = (fields: Record<string, string>) => {
		const form = new FormData();
		for (const [k, v] of Object.entries(fields)) form.set(k, v);
		return {
			locals: {},
			request: { formData: async () => form }
		} as unknown as Parameters<NonNullable<typeof actions.note>>[0];
	};

	it('offers the account’s actions, the reversals in its log and notes, and nothing on comments in bulk', () => {
		expect(Object.keys(actions).sort()).toEqual([
			'ban',
			'mute',
			'note',
			'rejectAccountReports',
			'reopenFlag',
			'restore',
			'unban',
			'unmute'
		]);
	});

	it('adds a note through the staff guard and does not rate-limit staff', async () => {
		addAccountNote.mockResolvedValue({ ok: true, title: null });
		const result = await actions.note(event({ userId: 'acct-1', body: ' Watch this one ' }));
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator']);
		expect(addAccountNote).toHaveBeenCalledWith(MOD, 'acct-1', 'Watch this one');
		expect(result).toEqual({ id: 'acct-1', done: 'note' });
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it('answers a note with no target 400 and writes nothing', async () => {
		const result = await actions.note(event({ body: 'x' }));
		expect(result).toMatchObject({ status: 400 });
		expect(addAccountNote).not.toHaveBeenCalled();
	});

	it.each([
		['invalid', 400],
		['not-found', 404],
		['forbidden-target', 403]
	])('maps a refused note (%s) to %i', async (reason, status) => {
		addAccountNote.mockResolvedValue({ ok: false, reason });
		expect(await actions.note(event({ userId: 'acct-1', body: 'x' }))).toMatchObject({ status });
	});

	it('runs the reversals from the log with the same guard and purge as the queue', async () => {
		unmuteUser.mockResolvedValue({
			ok: true,
			title: null,
			purge: { profiles: ['acct-1'] }
		});
		const result = await actions.unmute(event({ userId: 'acct-1' }));
		expect(unmuteUser).toHaveBeenCalledWith(MOD, 'acct-1', null);
		expect(result).toEqual({ id: 'acct-1', done: 'unmute' });
		expect(purgeProfiles).toHaveBeenCalledWith(['acct-1']);
	});
});
