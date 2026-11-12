import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from '#lib/server/env.ts';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { clearCache } from '#lib/server/cache/index.ts';

function fromIp(ip: string) {
	return { getClientAddress: vi.fn(() => ip) };
}

/** Calls rateLimit `n` times and returns how many went through before the first 429. */
async function allowed(n: number, ...args: Parameters<typeof rateLimit>) {
	let ok = 0;
	for (let i = 0; i < n; i++) {
		try {
			await rateLimit(...args);
			ok++;
		} catch (err) {
			expect(err).toMatchObject({ status: 429 });
		}
	}
	return ok;
}

beforeEach(async () => {
	vi.useFakeTimers();
	resetCloudflareStub();
	await clearCache();
});
afterEach(() => vi.useRealTimers());

// No binding in the env: the memory counters apply, with wrangler.jsonc's numbers.
describe('rateLimit without a binding (memory fallback)', () => {
	it("allows the bucket's limit per window, then throws 429", async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(5, event, 'RL_COMMENT')).toBe(5);
		await expect(rateLimit(event, 'RL_COMMENT')).rejects.toMatchObject({
			status: 429,
			body: { message: 'Too many requests' }
		});
	});

	it('resets once the window that the first request started ends', async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(7, event, 'RL_COMMENT')).toBe(5);
		vi.advanceTimersByTime(59_999);
		await expect(rateLimit(event, 'RL_COMMENT')).rejects.toMatchObject({ status: 429 });
		vi.advanceTimersByTime(1);
		expect(await allowed(5, event, 'RL_COMMENT')).toBe(5);
	});

	it('keys on the IP: another address has its own budget', async () => {
		expect(await allowed(6, fromIp('203.0.113.7'), 'RL_COMMENT')).toBe(5);
		expect(await allowed(5, fromIp('198.51.100.2'), 'RL_COMMENT')).toBe(5);
	});

	it('keys on the user when given one: same user across IPs shares a budget, IP is not read', async () => {
		const home = fromIp('203.0.113.7');
		const phone = fromIp('198.51.100.2');
		expect(await allowed(3, home, 'RL_COMMENT', { userId: 'alice' })).toBe(3);
		expect(await allowed(3, phone, 'RL_COMMENT', { userId: 'alice' })).toBe(2);
		expect(home.getClientAddress).not.toHaveBeenCalled();
		// Another user, and the bare IP, are unaffected.
		expect(await allowed(5, home, 'RL_COMMENT', { userId: 'bob' })).toBe(5);
		expect(await allowed(5, home, 'RL_COMMENT')).toBe(5);
	});

	it('counts each bucket separately, with its own limit', async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(6, event, 'RL_COMMENT')).toBe(5);
		expect(await allowed(11, event, 'RL_REPORT')).toBe(10);
	});
});

describe('rateLimit with a binding', () => {
	it('passes when the binding says success, keyed on the IP', async () => {
		const limit = vi.fn(async () => ({ success: true }));
		env.RL_SEARCH = { limit };
		await expect(rateLimit(fromIp('203.0.113.7'), 'RL_SEARCH')).resolves.toBeUndefined();
		expect(limit).toHaveBeenCalledExactlyOnceWith({ key: 'ip:203.0.113.7' });
	});

	it('keys on the user when given one', async () => {
		const limit = vi.fn(async () => ({ success: true }));
		env.RL_AVAILABILITY = { limit };
		const event = fromIp('203.0.113.7');
		await rateLimit(event, 'RL_AVAILABILITY', { userId: 'alice' });
		expect(limit).toHaveBeenCalledExactlyOnceWith({ key: 'user:alice' });
		expect(event.getClientAddress).not.toHaveBeenCalled();
	});

	it('throws 429 when the binding says the client is limited', async () => {
		env.RL_SEARCH = { limit: vi.fn(async () => ({ success: false })) };
		await expect(rateLimit(fromIp('203.0.113.7'), 'RL_SEARCH')).rejects.toMatchObject({
			status: 429,
			body: { message: 'Too many requests' }
		});
	});

	it('uses only the named bucket binding', async () => {
		const search = vi.fn(async () => ({ success: true }));
		const vote = vi.fn(async () => ({ success: true }));
		env.RL_SEARCH = { limit: search };
		env.RL_VOTE = { limit: vote };
		await rateLimit(fromIp('203.0.113.7'), 'RL_VOTE');
		expect(vote).toHaveBeenCalledOnce();
		expect(search).not.toHaveBeenCalled();
	});

	it('does not touch the memory counters', async () => {
		env.RL_COMMENT = { limit: vi.fn(async () => ({ success: true })) };
		// Far past the fallback's 5, and never limited.
		expect(await allowed(8, fromIp('203.0.113.7'), 'RL_COMMENT')).toBe(8);
	});

	it('fails open when the binding errors, and logs it', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		env.RL_SEARCH = { limit: vi.fn(async () => Promise.reject(new Error('limiter down'))) };
		await expect(rateLimit(fromIp('203.0.113.7'), 'RL_SEARCH')).resolves.toBeUndefined();
		expect(log).toHaveBeenCalledOnce();
		log.mockRestore();
	});
});
