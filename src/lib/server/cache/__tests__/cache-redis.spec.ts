import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Redis backend, with the optional `redis` package replaced by an in-test fake.
vi.mock('$env/dynamic/private', () => ({ env: { REDIS_URL: 'redis://redis.test:6379' } }));

const client = {
	on: vi.fn(),
	connect: vi.fn(async () => {}),
	get: vi.fn(),
	set: vi.fn(),
	incr: vi.fn(),
	pExpire: vi.fn(),
	flushDb: vi.fn()
};
vi.mock('redis', () => ({ createClient: () => client }));

const { incr } = await import('$lib/server/cache');

beforeEach(() => {
	client.incr.mockReset();
	client.pExpire.mockReset();
});

describe('redis backend incr', () => {
	it('INCRs, and sets the window with PEXPIRE on the first hit only', async () => {
		client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
		expect(await incr('rl:search:ip:1', 60_000)).toBe(1);
		expect(client.pExpire).toHaveBeenCalledExactlyOnceWith('rl:search:ip:1', 60_000);
		expect(await incr('rl:search:ip:1', 60_000)).toBe(2);
		expect(client.pExpire).toHaveBeenCalledOnce();
	});

	it('fails open: a Redis error counts as 0', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		client.incr.mockRejectedValueOnce(new Error('ECONNRESET'));
		expect(await incr('rl:search:ip:1', 60_000)).toBe(0);
		expect(log).toHaveBeenCalled();
		log.mockRestore();
	});
});
