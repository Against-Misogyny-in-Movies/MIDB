import { describe, it, expect } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { requireRole, requireUser } from '$lib/server/auth/guards';
import type { UserRow } from '$lib/server/data/user-queries';

function locals(user: Partial<UserRow> | null): App.Locals {
	return {
		claims: user ? { sub: 'sub-1' } : null,
		getUser: async () => (user ? ({ id: 'sub-1', role: 'user', ...user } as UserRow) : null)
	};
}

async function thrown(p: Promise<unknown>): Promise<unknown> {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('expected the guard to throw');
}

describe('requireUser', () => {
	it('returns the user when signed in', async () => {
		await expect(requireUser(locals({ id: 'sub-1' }))).resolves.toMatchObject({ id: 'sub-1' });
	});

	it('redirects page loads to /auth', async () => {
		const e = await thrown(requireUser(locals(null), { page: true }));
		expect(isRedirect(e)).toBe(true);
		expect(e).toMatchObject({ status: 303, location: '/auth' });
	});

	it('answers 401 for actions and endpoints (the default)', async () => {
		const e = await thrown(requireUser(locals(null)));
		expect(isHttpError(e, 401)).toBe(true);
	});
});

describe('requireRole', () => {
	it('returns the user when the role matches', async () => {
		const user = await requireRole(locals({ role: 'moderator' }), ['moderator', 'administrator']);
		expect(user.role).toBe('moderator');
	});

	it('answers 403 for the wrong role, on pages too', async () => {
		const e = await thrown(requireRole(locals({ role: 'user' }), ['moderator']));
		expect(isHttpError(e, 403)).toBe(true);
		const page = await thrown(requireRole(locals({ role: 'user' }), ['moderator'], { page: true }));
		expect(isHttpError(page, 403)).toBe(true);
	});

	it('checks for a user before the role: 401 or redirect when signed out', async () => {
		expect(isHttpError(await thrown(requireRole(locals(null), ['moderator'])), 401)).toBe(true);
		expect(isRedirect(await thrown(requireRole(locals(null), ['moderator'], { page: true })))).toBe(
			true
		);
	});
});
