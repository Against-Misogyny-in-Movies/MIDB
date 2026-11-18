import { error, isHttpError } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const rateLimit = vi.fn();
const listStaff = vi.fn();
const setStaffRole = vi.fn();
const purgeProfiles = vi.fn();

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	rateLimit: (...args: unknown[]) => rateLimit(...args)
}));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeTitlesComments: vi.fn(),
	purgeProfiles: (...args: unknown[]) => purgeProfiles(...args),
	purgeTitlesReports: vi.fn()
}));
vi.mock('#lib/server/data/staff-roles.ts', () => ({
	listStaff: (...args: unknown[]) => listStaff(...args),
	setStaffRole: (...args: unknown[]) => setStaffRole(...args)
}));

const { load, actions } = await import('../+page.server');

const ADMIN = { id: 'adm', role: 'administrator' };

beforeEach(() => {
	requireRole.mockReset().mockResolvedValue(ADMIN);
	rateLimit.mockReset();
	listStaff.mockReset().mockResolvedValue([]);
	setStaffRole.mockReset();
	purgeProfiles.mockReset();
});

describe('load', () => {
	it('is for administrators only, as a page', async () => {
		await load({ locals: {} } as Parameters<typeof load>[0]);
		expect(requireRole).toHaveBeenCalledWith({}, ['administrator'], { page: true });
	});

	it.each([403, 401])('answers %i and reads nothing for anyone the guard stops', async (status) => {
		requireRole.mockImplementation(async () => error(status, 'no'));
		await expect(load({ locals: {} } as Parameters<typeof load>[0])).rejects.toSatisfy(
			(e) => isHttpError(e) && e.status === status
		);
		expect(listStaff).not.toHaveBeenCalled();
	});

	it('returns the staff list', async () => {
		listStaff.mockResolvedValue([{ user: { id: 'm' }, since: 'x' }]);
		expect(await load({ locals: {} } as Parameters<typeof load>[0])).toEqual({
			staff: [{ user: { id: 'm' }, since: 'x' }]
		});
	});
});

describe('actions', () => {
	const event = (fields: Record<string, string>) => {
		const form = new FormData();
		for (const [k, v] of Object.entries(fields)) form.set(k, v);
		return { locals: {}, request: { formData: async () => form } } as unknown as Parameters<
			typeof actions.makeModerator
		>[0];
	};

	it('offers only the two role changes', () => {
		expect(Object.keys(actions).sort()).toEqual(['makeModerator', 'removeModerator']);
	});

	it('makes a moderator by username, through the administrator guard, never rate-limited', async () => {
		setStaffRole.mockResolvedValue({ ok: true, title: null, purge: { profiles: ['u1'] } });
		const result = await actions.makeModerator(event({ username: ' woolf_2210 ' }));
		expect(requireRole).toHaveBeenCalledWith({}, ['administrator']);
		expect(setStaffRole).toHaveBeenCalledWith(ADMIN, { username: 'woolf_2210' }, 'moderator');
		expect(result).toEqual({ id: 'woolf_2210', done: 'makeModerator' });
		expect(purgeProfiles).toHaveBeenCalledWith(['u1']);
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it('removes the role by id and takes no role from the form', async () => {
		setStaffRole.mockResolvedValue({ ok: true, title: null, purge: { profiles: ['m1'] } });
		const result = await actions.removeModerator(event({ userId: 'm1', role: 'administrator' }));
		expect(setStaffRole).toHaveBeenCalledWith(ADMIN, { id: 'm1' }, 'user');
		expect(result).toEqual({ id: 'm1', done: 'removeModerator' });
	});

	it('answers 403 and writes nothing for a moderator, before reading the form', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(actions.makeModerator(event({ username: 'x' }))).rejects.toSatisfy(
			(e) => isHttpError(e) && e.status === 403
		);
		expect(setStaffRole).not.toHaveBeenCalled();
	});

	it('answers 400 for a form with no target, writing nothing', async () => {
		expect(await actions.makeModerator(event({}))).toMatchObject({ status: 400 });
		expect(await actions.removeModerator(event({}))).toMatchObject({ status: 400 });
		expect(setStaffRole).not.toHaveBeenCalled();
	});

	it.each([
		['not-administrator', 403],
		['unknown-account', 404],
		['not-found', 404],
		['account-banned', 409],
		['already-role', 409],
		['is-administrator', 403],
		['last-administrator', 409]
	])('maps the refusal %s to %i with its own message, purging nothing', async (reason, status) => {
		setStaffRole.mockResolvedValue({ ok: false, reason });
		const result = (await actions.makeModerator(event({ username: 'x' }))) as {
			status: number;
			data: { error: string };
		};
		expect(result.status).toBe(status);
		expect(result.data.error.length).toBeGreaterThan(10);
		expect(purgeProfiles).not.toHaveBeenCalled();
	});
});
