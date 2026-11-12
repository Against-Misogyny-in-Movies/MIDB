import { describe, it, expect, vi } from 'vitest';
import { fetchSource, USER_AGENT } from '../http.ts';

const options = { timeoutMs: 1000, retryDelayMs: 0 };

describe('fetchSource', () => {
	it('sends the identifying User-Agent', async () => {
		const fetchImpl = vi.fn(async () => new Response('ok'));
		await fetchSource('https://example.test/x', { ...options, fetchImpl });
		const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
		expect(init.headers).toEqual({ 'User-Agent': USER_AGENT });
		expect(USER_AGENT).toMatch(/^MIDB-sync \(\+https:\/\/github\.com\//);
	});

	it('retries once after a server error, then returns the response', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response('busy', { status: 503 }))
			.mockResolvedValueOnce(new Response('ok'));
		const res = await fetchSource('https://example.test/x', { ...options, fetchImpl });
		expect(await res!.text()).toBe('ok');
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('retries once after a network error, then throws', async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('reset'));
		await expect(fetchSource('https://example.test/x', { ...options, fetchImpl })).rejects.toThrow(
			/Could not read/
		);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('does not retry a client error', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 410 }));
		await expect(
			fetchSource('https://example.test/x', { ...options, fetchImpl })
		).rejects.toThrow();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('returns null for a 404 only when asked to', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 404 }));
		expect(
			await fetchSource('https://example.test/x', { ...options, fetchImpl, notFoundIsNull: true })
		).toBeNull();
		await expect(
			fetchSource('https://example.test/x', { ...options, fetchImpl })
		).rejects.toThrow();
	});
});
