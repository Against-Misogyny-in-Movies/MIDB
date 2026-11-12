import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateProfile = vi.fn();

vi.mock('$lib/server/auth/guards', () => ({
	requireUser: vi.fn(async () => ({ id: 'user-1' }))
}));
vi.mock('$lib/server/data/user-queries', () => ({
	updateProfile: (...args: unknown[]) => updateProfile(...args),
	toPublicUser: vi.fn((u: unknown) => u)
}));

import { actions } from '../+page.server';

function run(form: FormData) {
	const request = new Request('http://localhost/user/profile', { method: 'POST', body: form });
	// The action only reads `request` and `locals`.
	return actions.updateProfile({ request, locals: {} } as Parameters<
		typeof actions.updateProfile
	>[0]);
}

describe('updateProfile action', () => {
	beforeEach(() => updateProfile.mockReset());

	it('fails with 422 username-format when username is a file part', async () => {
		const form = new FormData();
		form.set('username', new File(['x'], 'x.txt'));
		const result = await run(form);
		expect(result).toMatchObject({ status: 422, data: { error: 'username-format' } });
		expect(updateProfile).not.toHaveBeenCalled();
	});

	it('trims a string username and passes it on', async () => {
		updateProfile.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
		const form = new FormData();
		form.set('username', '  alice  ');
		await run(form);
		expect(updateProfile).toHaveBeenCalledWith('user-1', { username: 'alice' });
	});
});
