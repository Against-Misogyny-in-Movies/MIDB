import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '#lib/server/env.ts';
import { clearCache } from '#lib/server/cache/index.ts';
import {
	getLetterboxdRating,
	letterboxdConfigured,
	signRequest
} from '#lib/server/integrations/letterboxd.ts';

const INPUTS = { nonce: 'nonce-1', timestamp: 1_700_000_000 };

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

	it('is null for a non-200 lookup', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({}, false));
		expect(await getLetterboxdRating('1', INPUTS)).toBeNull();
	});

	it('is null for a non-200 statistics answer', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json({}, false));
		expect(await getLetterboxdRating('2', INPUTS)).toBeNull();
	});

	it.each([
		['no items', { items: [] }],
		['a body that is not an object', 'nope'],
		['an item without an id', { items: [{ links: [] }] }]
	])('is null for a malformed lookup: %s', async (_name, body) => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(body));
		expect(await getLetterboxdRating('3', INPUTS)).toBeNull();
	});

	it.each([
		['no rating', {}],
		['a rating out of range', { rating: 9 }],
		['a rating that is not a number', { rating: '4' }]
	])('is null for malformed statistics: %s', async (_name, body) => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json(lookupBody))
			.mockResolvedValueOnce(json(body));
		expect(await getLetterboxdRating('4', INPUTS)).toBeNull();
	});

	it('is null on a timeout or a network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('t', 'TimeoutError'));
		expect(await getLetterboxdRating('5', INPUTS)).toBeNull();
	});

	it('is null when the body is not JSON', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
			ok: true,
			json: async () => {
				throw new SyntaxError('bad');
			}
		} as unknown as Response);
		expect(await getLetterboxdRating('6', INPUTS)).toBeNull();
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
