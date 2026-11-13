import { env } from '#lib/server/env.ts';
import { getCached } from '#lib/server/cache/index.ts';
import type { LetterboxdResult } from './letterboxd-types';

export type { LetterboxdResult } from './letterboxd-types';

// ── Unconfirmed assumptions about the Letterboxd API ────────────────────────────────────
// No key existed when this was written, so none of this has been run against the real API.
// Every guess is in this block; `docs/phases/STATUS.md`, Open items, says to test it.
//   1. Base URL and version.
//   2. `GET /films?filmId=tmdb:<id>` finds a film by TMDB id; the answer is `{ items: [film] }`
//      and the film has `id` and `links: [{ type: 'letterboxd', url }]`.
//   3. `GET /film/{id}/statistics` answers `{ rating, counts: { ratings } }`, `rating` being
//      the 0–5 average and absent for a film with too few ratings.
//   4. A request carries `apikey`, `nonce` and `timestamp` (Unix seconds) as query parameters,
//      and `Authorization: Signature <hex>`, the HMAC-SHA256 under the API secret of
//      `METHOD`, the full URL and the body (empty for a GET) joined by NUL characters.
//   5. These read endpoints need no OAuth token.
const API_BASE = 'https://api.letterboxd.com/api/v0';
const FALLBACK_PAGE = 'https://letterboxd.com/tmdb';
// ────────────────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // one day
// A failed lookup is kept briefly: long enough to spare the API a retry storm, short enough
// that an outage does not hide a rating for a day.
const FAILED_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 5000;

interface Lookup {
	result: LetterboxdResult | null;
	failed: boolean;
}

/** Overridable in tests so a signature is deterministic. */
export interface SigningInputs {
	nonce: string;
	timestamp: number;
}

const freshInputs = (): SigningInputs => ({
	nonce: crypto.randomUUID(),
	timestamp: Math.floor(Date.now() / 1000)
});

/** Both keys are set: without them the integration is off and the page renders no slot. */
export function letterboxdConfigured(): boolean {
	return Boolean(env.LETTERBOXD_API_KEY && env.LETTERBOXD_API_SECRET);
}

const toHex = (bytes: ArrayBuffer) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The hex HMAC-SHA256 of `METHOD NUL url NUL body` under `secret`. */
export async function signRequest(
	method: string,
	url: string,
	body: string,
	secret: string
): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${method}\0${url}\0${body}`));
	return toHex(mac);
}

/** A signed GET: the query gets the key, nonce and timestamp, and the header carries the signature. */
async function signedGet(path: string, params: Record<string, string>, inputs: SigningInputs) {
	const key = env.LETTERBOXD_API_KEY ?? '';
	const query = new URLSearchParams({
		...params,
		apikey: key,
		nonce: inputs.nonce,
		timestamp: String(inputs.timestamp)
	});
	const url = `${API_BASE}${path}?${query}`;
	const signature = await signRequest('GET', url, '', env.LETTERBOXD_API_SECRET ?? '');
	return fetch(url, {
		headers: { Accept: 'application/json', Authorization: `Signature ${signature}` },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The film's id and page from a lookup answer, or null when the answer has no film. */
function parseFilm(body: unknown, tmdbId: string): { id: string; url: string } | null {
	if (!isRecord(body) || !Array.isArray(body.items)) return null;
	const film: unknown = body.items[0];
	if (!isRecord(film) || typeof film.id !== 'string') return null;
	const links = Array.isArray(film.links) ? (film.links as unknown[]) : [];
	const own = links.find((l) => isRecord(l) && l.type === 'letterboxd');
	const url = isRecord(own) && typeof own.url === 'string' ? own.url : null;
	return { id: film.id, url: url ?? `${FALLBACK_PAGE}/${encodeURIComponent(tmdbId)}` };
}

/** The average and its count from a statistics answer, or null when there is no average. */
function parseStats(body: unknown): { rating: number; ratingCount: number | null } | null {
	if (!isRecord(body)) return null;
	const rating = body.rating;
	if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5) {
		return null;
	}
	const count = isRecord(body.counts) ? body.counts.ratings : null;
	return { rating, ratingCount: typeof count === 'number' ? count : null };
}

async function lookup(tmdbId: string, inputs: SigningInputs): Promise<Lookup> {
	try {
		const found = await signedGet('/films', { filmId: `tmdb:${tmdbId}`, perPage: '1' }, inputs);
		if (!found.ok) return { result: null, failed: true };
		const film = parseFilm(await found.json(), tmdbId);
		if (!film) return { result: null, failed: false };

		const statsRes = await signedGet(`/film/${encodeURIComponent(film.id)}/statistics`, {}, inputs);
		if (!statsRes.ok) return { result: null, failed: true };
		const stats = parseStats(await statsRes.json());
		return { result: stats ? { ...stats, url: film.url } : null, failed: false };
	} catch {
		// Timeout, network error or a body that is not JSON: the score is absent.
		return { result: null, failed: true };
	}
}

/**
 * The Letterboxd average rating and page of a film, by TMDB id. Null without both keys, for a
 * film Letterboxd does not know or has no average for, and on any error or timeout. Answers are
 * cached for a day (a failed one for a minute) under a key that holds the TMDB id only, never
 * the keys.
 *
 * @param tmdbId - The film's TMDB id.
 * @param inputs - A fixed nonce and timestamp, for tests.
 */
export async function getLetterboxdRating(
	tmdbId: string,
	inputs?: SigningInputs
): Promise<LetterboxdResult | null> {
	if (!letterboxdConfigured()) return null;
	const { result } = await getCached<Lookup>(
		`letterboxd:tmdb:${tmdbId}`,
		(l) => (l.failed ? FAILED_TTL_MS : CACHE_TTL_MS),
		() => lookup(tmdbId, inputs ?? freshInputs())
	);
	return result;
}
