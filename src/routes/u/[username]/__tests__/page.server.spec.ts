import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { PUBLIC_PAGE } from '#lib/server/http/cache.ts';

const getPublicProfile = vi.fn();
vi.mock('#lib/server/data/profile-queries.ts', () => ({
	getPublicProfile: (...args: unknown[]) => getPublicProfile(...args)
}));

import { load } from '../+page.server';

const PROFILE = { id: 'anna-id', username: 'anna', comments: { comments: [], nextCursor: null } };

function run(username: string) {
	const setHeaders = vi.fn();
	const getUser = vi.fn(async () => null);
	const result = load({
		params: { username },
		setHeaders,
		locals: { getUser }
	} as unknown as Parameters<typeof load>[0]);
	return { result, setHeaders, getUser };
}

beforeEach(() => getPublicProfile.mockReset());

describe('/u/[username] load', () => {
	it('returns the profile with PUBLIC_PAGE and the account’s cache tag, never reading the user', async () => {
		getPublicProfile.mockResolvedValue(PROFILE);
		const { result, setHeaders, getUser } = run('Anna');
		await expect(result).resolves.toEqual({ profile: PROFILE });
		expect(getPublicProfile).toHaveBeenCalledWith('Anna');
		expect(setHeaders).toHaveBeenCalledExactlyOnceWith({
			...PUBLIC_PAGE,
			'cache-tag': 'profile:anna-id'
		});
		expect(getUser).not.toHaveBeenCalled();
	});

	it('is a 404 with no cache policy for a missing, banned or username-less account', async () => {
		getPublicProfile.mockResolvedValue(null);
		const { result, setHeaders, getUser } = run('nobody');
		await expect(result).rejects.toSatisfy((e) => isHttpError(e) && e.status === 404);
		expect(setHeaders).not.toHaveBeenCalled();
		expect(getUser).not.toHaveBeenCalled();
	});
});
