import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const handler = vi.fn<(request: Request) => Promise<Response>>();
const rateLimit = vi.fn(async () => {});

vi.mock('#lib/server/auth/auth.ts', () => ({ getAuth: () => ({ handler }) }));
vi.mock('#lib/server/http/rate-limit.ts', () => ({ rateLimit }));

const { GET, POST } = await import('../routes/api/auth/[...all]/+server');

function call(method: typeof GET) {
	const event = {
		request: new Request('http://localhost/api/auth/ok'),
		getClientAddress: () => '203.0.113.7'
	} as unknown as RequestEvent;
	return method(event as Parameters<typeof GET>[0]);
}

beforeEach(() => {
	handler.mockReset();
	rateLimit.mockClear();
});

describe('/api/auth/[...all]', () => {
	it('rate-limits by IP in RL_AUTH before Better Auth runs', async () => {
		handler.mockResolvedValue(new Response('ok'));
		await call(GET);
		expect(rateLimit).toHaveBeenCalledOnce();
		expect(rateLimit.mock.calls[0] as unknown[]).toEqual([expect.anything(), 'RL_AUTH']);
	});

	it('does not reach Better Auth once the limit throws', async () => {
		rateLimit.mockRejectedValueOnce(new Error('429'));
		await expect(call(POST)).rejects.toThrow('429');
		expect(handler).not.toHaveBeenCalled();
	});

	it('forces private, no-store over what Better Auth sent, keeping its cookies', async () => {
		handler.mockResolvedValue(
			new Response('ok', {
				headers: { 'cache-control': 'public, max-age=60', 'set-cookie': 'a=b; Path=/' }
			})
		);
		const res = await call(POST);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.get('set-cookie')).toBe('a=b; Path=/');
	});

	it('copes with an immutable response', async () => {
		handler.mockResolvedValue(Response.redirect('http://localhost/x', 302));
		const res = await call(GET);
		expect(res.status).toBe(302);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});
});
