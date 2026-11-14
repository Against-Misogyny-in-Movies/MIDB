import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateProfile = vi.fn();
const purgeProfile = vi.fn();

const requireUser = vi.hoisted(() => vi.fn<() => Promise<{ id: string; role?: string }>>());
vi.mock('#lib/server/auth/guards.ts', () => ({ requireUser }));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeProfile: (...args: unknown[]) => purgeProfile(...args)
}));
vi.mock('#lib/server/data/user-queries.ts', () => ({
	updateProfile: (...args: unknown[]) => updateProfile(...args),
	toPublicUser: vi.fn((u: unknown) => u)
}));

import { actions } from '../+page.server';
import { clearCache } from '#lib/server/cache/index.ts';

function run(form: FormData) {
	const request = new Request('http://localhost/user/settings', { method: 'POST', body: form });
	// The action only reads `request` and `locals`.
	return actions.updateProfile({ request, locals: {} } as Parameters<
		typeof actions.updateProfile
	>[0]);
}

describe('updateProfile action', () => {
	beforeEach(async () => {
		await clearCache();
		requireUser.mockReset();
		requireUser.mockResolvedValue({ id: 'user-1' });
		updateProfile.mockReset();
		purgeProfile.mockReset();
	});

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

	it('purges the public profile after a saved change, and not after a refusal', async () => {
		updateProfile.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
		const form = new FormData();
		form.set('avatarKey', 'anna');
		await run(form);
		expect(purgeProfile).toHaveBeenCalledExactlyOnceWith('user-1');

		purgeProfile.mockReset();
		updateProfile.mockResolvedValue({ ok: false, reason: 'username-taken' });
		const taken = new FormData();
		taken.set('username', 'bea');
		await run(taken);
		expect(purgeProfile).not.toHaveBeenCalled();
	});

	it('rate-limits a member at 10 saves a minute, and not staff', async () => {
		updateProfile.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
		const form = () => {
			const f = new FormData();
			f.set('avatarKey', 'anna');
			return f;
		};
		for (let i = 0; i < 10; i++) await run(form());
		await expect(run(form())).rejects.toMatchObject({ status: 429 });

		requireUser.mockResolvedValue({ id: 'user-1', role: 'moderator' });
		await expect(run(form())).resolves.toMatchObject({ success: true });
	});
});
