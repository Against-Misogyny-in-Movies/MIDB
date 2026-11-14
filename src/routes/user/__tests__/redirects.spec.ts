import { describe, expect, it } from 'vitest';

const profile = await import('../profile/+server.ts');
const comments = await import('../comments/+server.ts');
const metrics = await import('../metrics/+server.ts');
const security = await import('../security/+server.ts');

type Handler = (event: never) => unknown;

const signedIn = (username: string | null) =>
	({
		locals: { getUser: async () => ({ id: 'u', username }) },
		url: new URL('http://localhost/')
	}) as never;

/** The redirect a handler throws: its status and location. */
async function redirectOf(handler: Handler, event: never) {
	try {
		await handler(event);
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('no redirect');
}

describe('the old account pages', () => {
	it.each([
		['/user/profile', profile.GET, '/u/anna'],
		['/user/comments', comments.GET, '/u/anna'],
		['/user/metrics', metrics.GET, '/u/anna#reports']
	])('%s goes to the reader’s profile', async (_path, handler, location) => {
		expect(await redirectOf(handler as Handler, signedIn('anna'))).toMatchObject({
			status: 303,
			location
		});
	});

	it('sends a signed-out reader to sign in', async () => {
		const event = { locals: { getUser: async () => null } } as never;
		expect(await redirectOf(profile.GET as Handler, event)).toMatchObject({
			status: 303,
			location: '/auth'
		});
	});

	it('moves /user/security to /user/settings with its query', async () => {
		const event = { url: new URL('http://localhost/user/security?linked=google') } as never;
		expect(await redirectOf(security.GET as Handler, event)).toMatchObject({
			status: 308,
			location: '/user/settings?linked=google'
		});
	});
});
