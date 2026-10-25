import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { rateLimit } = await import('$lib/server/http/rate-limit');
const { clearCache } = await import('$lib/server/cache');

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
	await clearCache();
});
afterEach(() => vi.useRealTimers());

describe('rateLimit', () => {
	it('allows `limit` requests per window, then throws 429', async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(3, event, 'b', 3, 60_000)).toBe(3);
		await expect(rateLimit(event, 'b', 3, 60_000)).rejects.toMatchObject({
			status: 429,
			body: { message: 'Too many requests' }
		});
	});

	it('resets once the window that the first request started ends', async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(5, event, 'b', 3, 60_000)).toBe(3);
		vi.advanceTimersByTime(59_999);
		await expect(rateLimit(event, 'b', 3, 60_000)).rejects.toMatchObject({ status: 429 });
		vi.advanceTimersByTime(1);
		expect(await allowed(3, event, 'b', 3, 60_000)).toBe(3);
	});

	it('keys on the IP: another address has its own budget', async () => {
		expect(await allowed(4, fromIp('203.0.113.7'), 'b', 3, 60_000)).toBe(3);
		expect(await allowed(3, fromIp('198.51.100.2'), 'b', 3, 60_000)).toBe(3);
	});

	it('keys on the user when given one: same user across IPs shares a budget, IP is not read', async () => {
		const home = fromIp('203.0.113.7');
		const phone = fromIp('198.51.100.2');
		expect(await allowed(2, home, 'b', 3, 60_000, { userId: 'alice' })).toBe(2);
		expect(await allowed(2, phone, 'b', 3, 60_000, { userId: 'alice' })).toBe(1);
		expect(home.getClientAddress).not.toHaveBeenCalled();
		// Another user, and the bare IP, are unaffected.
		expect(await allowed(3, home, 'b', 3, 60_000, { userId: 'bob' })).toBe(3);
		expect(await allowed(3, home, 'b', 3, 60_000)).toBe(3);
	});

	it('counts each bucket separately', async () => {
		const event = fromIp('203.0.113.7');
		expect(await allowed(4, event, 'search', 3, 60_000)).toBe(3);
		expect(await allowed(3, event, 'other', 3, 60_000)).toBe(3);
	});
});
