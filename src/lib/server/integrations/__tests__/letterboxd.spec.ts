import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '#lib/server/env.ts';
import { clearCache } from '#lib/server/cache/index.ts';
import {
	getLetterboxdRating,
	letterboxdConfigured,
	signRequest
} from '#lib/server/integrations/letterboxd.ts';

const INPUTS = () => ({ nonce: 'nonce-1', timestamp: 1_700_000_000 });

const urlOf = (call: unknown[] | undefined) => call?.[0] as string;
const headersOf = (call: unknown[] | undefined) =>
	((call?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const lookupBody = {
	items: [{ id: 'abc12', links: [{ type: 'letterboxd', url: 'https://boxd.it/abc12' }] }]
};
const statsBody = { rating: 3.86, counts: { ratings: 1234 } };

const hmac = async (message: string, secret: string) => {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

beforeEach(async () => {
	env.LETTERBOXD_API_KEY = 'key-1';
	env.LETTERBOXD_API_SECRET = 'secret-1';
	await clearCache();
});

afterEach(() => {
	delete env.LETTERBOXD_API_KEY;
	delete env.LETTERBOXD_API_SECRET;
	vi.restoreAllMocks();
});

describe('signRequest', () => {
	it('is the hex HMAC-SHA256 of method, url and body joined by NUL', async () => {
		const sig = await signRequest('GET', 'https://x.test/a?b=1', '', 's');
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
		expect(sig).toBe(await hmac('GET\0https://x.test/a?b=1\0', 's'));
	});
});

describe('letterboxdConfigured', () => {
	it('needs both keys', () => {
		expect(letterboxdConfigured()).toBe(true);
		delete env.LETTERBOXD_API_SECRET;
		expect(letterboxdConfigured()).toBe(false);
	});
});

describe('getLetterboxdRating', () => {
	it('looks the film up by TMDB id, signs the request and maps the rating', async () => {
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(statsBody));

		const result = await getLetterboxdRating('603', INPUTS);

		expect(result).toEqual({ rating: 3.86, ratingCount: 1234, url: 'https://boxd.it/abc12' });
		const lookupUrl = urlOf(spy.mock.calls[0]);
		const parsed = new URL(lookupUrl);
		expect(parsed.origin + parsed.pathname).toBe('https://api.letterboxd.com/api/v0/films');
		expect(parsed.searchParams.get('filmId')).toBe('tmdb:603');
		expect(parsed.searchParams.get('apikey')).toBe('key-1');
		expect(parsed.searchParams.get('nonce')).toBe('nonce-1');
		expect(parsed.searchParams.get('timestamp')).toBe('1700000000');
		const headers = headersOf(spy.mock.calls[0]);
		expect(headers.Authorization).toBe(
			`Signature ${await hmac(`GET\0${lookupUrl}\0`, 'secret-1')}`
		);
		expect(urlOf(spy.mock.calls[1])).toContain('/film/abc12/statistics?');
	});

	it('never puts a key in the cache key or a secret in a URL', async () => {
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(statsBody));
		await getLetterboxdRating('603', INPUTS);
		for (const call of spy.mock.calls) expect(urlOf(call)).not.toContain('secret-1');
	});

	it('falls back to the TMDB redirect page when the film has no Letterboxd link', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ items: [{ id: 'abc12' }] }))
			.mockResolvedValueOnce(json({ rating: 4 }));
		expect(await getLetterboxdRating('603', INPUTS)).toEqual({
			rating: 4,
			ratingCount: null,
			url: 'https://letterboxd.com/tmdb/603'
		});
	});

	it('is null without a key, and makes no request', async () => {
		delete env.LETTERBOXD_API_KEY;
		const spy = vi.spyOn(globalThis, 'fetch');
		expect(await getLetterboxdRating('603', INPUTS)).toBeNull();
		expect(spy).not.toHaveBeenCalled();
	});

	it('is failed for a non-200 lookup', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({}, false));
		expect(await getLetterboxdRating('1', INPUTS)).toBe('failed');
	});

	it('is failed for a non-200 statistics answer', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json({}, false));
		expect(await getLetterboxdRating('2', INPUTS)).toBe('failed');
	});

	it('is null, not failed, for a film Letterboxd does not know', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ items: [] }));
		expect(await getLetterboxdRating('3', INPUTS)).toBeNull();
	});

	it('is null, not failed, for a film with no average', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json({ counts: { ratings: 3 } }));
		expect(await getLetterboxdRating('4', INPUTS)).toBeNull();
	});

	it.each([
		['a body that is not an object', 'nope'],
		['an item without an id', { items: [{ links: [] }] }]
	])('is failed for a malformed lookup: %s', async (_name, body) => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(body));
		expect(await getLetterboxdRating('8', INPUTS)).toBe('failed');
	});

	it.each([
		['a rating out of range', { rating: 9 }],
		['a rating that is not a number', { rating: '4' }],
		['a body that is not an object', 'nope']
	])('is failed for malformed statistics: %s', async (_name, body) => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(body));
		expect(await getLetterboxdRating('9', INPUTS)).toBe('failed');
	});

	it('is failed on a timeout or a network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('t', 'TimeoutError'));
		expect(await getLetterboxdRating('5', INPUTS)).toBe('failed');
	});

	it('draws a fresh nonce for each of the two requests', async () => {
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(statsBody));
		await getLetterboxdRating('10');
		const nonces = spy.mock.calls.map((c) => new URL(urlOf(c)).searchParams.get('nonce'));
		expect(nonces).toHaveLength(2);
		expect(nonces[0]).toBeTruthy();
		expect(nonces[1]).toBeTruthy();
		expect(nonces[0]).not.toBe(nonces[1]);
	});

	it('shares one timeout signal between the two requests', async () => {
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(statsBody));
		await getLetterboxdRating('11', INPUTS);
		const signals = spy.mock.calls.map((c) => (c[1] as RequestInit).signal);
		expect(signals[0]).toBeInstanceOf(AbortSignal);
		expect(signals[0]).toBe(signals[1]);
	});

	it.each([
		['https://letterboxd.com/film/the-matrix/', 'https://letterboxd.com/film/the-matrix/'],
		['https://boxd.it/abc12', 'https://boxd.it/abc12'],
		['https://www.letterboxd.com/film/x/', 'https://www.letterboxd.com/film/x/']
	])('keeps the film link %s', async (url, expected) => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ items: [{ id: 'a', links: [{ type: 'letterboxd', url }] }] }))
			.mockResolvedValueOnce(json(statsBody));
		const result = await getLetterboxdRating('12', INPUTS);
		expect(result).toMatchObject({ url: expected });
	});

	it.each([
		['javascript:alert(1)'],
		['http://letterboxd.com/film/x/'],
		['https://evil.example/film/x/'],
		['https://letterboxd.com.evil.example/'],
		['https://notletterboxd.com/'],
		['not a url']
	])('replaces the unsafe film link %s with the fallback page', async (url) => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ items: [{ id: 'a', links: [{ type: 'letterboxd', url }] }] }))
			.mockResolvedValueOnce(json(statsBody));
		const result = await getLetterboxdRating('603', INPUTS);
		expect(result).toMatchObject({ url: 'https://letterboxd.com/tmdb/603' });
	});

	it('is failed when the body is not JSON', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
			ok: true,
			json: async () => {
				throw new SyntaxError('bad');
			}
		} as unknown as Response);
		expect(await getLetterboxdRating('6', INPUTS)).toBe('failed');
	});

	it('answers a repeat lookup from the cache', async () => {
		const spy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(statsBody));
		await getLetterboxdRating('7', INPUTS);
		await getLetterboxdRating('7', INPUTS);
		expect(spy).toHaveBeenCalledTimes(2); // the lookup and the statistics, once
	});
});
