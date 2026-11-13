import { env } from '#lib/server/env.ts';
import { getCached } from '#lib/server/cache/index.ts';
import type { LetterboxdOutcome, LetterboxdResult } from './letterboxd-types';

export type { LetterboxdOutcome, LetterboxdResult } from './letterboxd-types';

// ── Unconfirmed assumptions about the Letterboxd API ────────────────────────────────────
// No key existed when this was written, so none of this has been run against the real API.
// Every guess is in this block; `docs/phases/STATUS.md`, Open items, says to test it:
// "Letterboxd: test the client against the real API once keys exist; the assumptions are listed
// in `src/lib/server/integrations/letterboxd.ts`."
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
// A film link from the API is used only on these hosts (and their subdomains).
const LINK_HOSTS = ['letterboxd.com', 'boxd.it'];
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

/** The nonce and timestamp of one request; a factory of them is overridable in tests. */
export interface SigningInputs {
	nonce: string;
	timestamp: number;
}

export type SigningInputsFactory = () => SigningInputs;

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
async function signedGet(
	path: string,
	params: Record<string, string>,
	inputs: SigningInputs,
	signal: AbortSignal
) {
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
		signal
	});
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** The link only when it is an https page on Letterboxd's own hosts. */
function safeFilmUrl(url: unknown): string | null {
	if (typeof url !== 'string') return null;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:') return null;
		const host = parsed.hostname.toLowerCase();
		const ok = LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
		return ok ? parsed.href : null;
	} catch {
		return null;
	}
}

/**
 * The film's id and page from a lookup answer, or null when Letterboxd has no such film.
 *
 * @throws When the answer does not have the expected shape.
 */
function parseFilm(body: unknown, tmdbId: string): { id: string; url: string } | null {
	if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('unexpected lookup body');
	if (body.items.length === 0) return null;
	const film: unknown = body.items[0];
	if (!isRecord(film) || typeof film.id !== 'string') throw new Error('unexpected film');
	const links = Array.isArray(film.links) ? (film.links as unknown[]) : [];
	const own = links.find((l) => isRecord(l) && l.type === 'letterboxd');
	const url = isRecord(own) ? safeFilmUrl(own.url) : null;
	return { id: film.id, url: url ?? `${FALLBACK_PAGE}/${encodeURIComponent(tmdbId)}` };
}

/**
 * The average and its count from a statistics answer, or null when the film has no average.
 *
 * @throws When the answer does not have the expected shape.
 */
function parseStats(body: unknown): { rating: number; ratingCount: number | null } | null {
	if (!isRecord(body)) throw new Error('unexpected statistics body');
	const rating = body.rating;
	if (rating === undefined || rating === null) return null;
	if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5) {
		throw new Error('unexpected rating');
	}
	const count = isRecord(body.counts) ? body.counts.ratings : null;
	return { rating, ratingCount: typeof count === 'number' ? count : null };
}

async function lookup(tmdbId: string, inputs: SigningInputsFactory): Promise<Lookup> {
	// One signal for both requests, so the whole lookup is bounded by TIMEOUT_MS.
	const signal = AbortSignal.timeout(TIMEOUT_MS);
	try {
		const found = await signedGet(
			'/films',
			{ filmId: `tmdb:${tmdbId}`, perPage: '1' },
			inputs(),
			signal
		);
		if (!found.ok) return { result: null, failed: true };
		const film = parseFilm(await found.json(), tmdbId);
		if (!film) return { result: null, failed: false };

		const statsRes = await signedGet(
			`/film/${encodeURIComponent(film.id)}/statistics`,
			{},
			inputs(),
			signal
		);
		if (!statsRes.ok) return { result: null, failed: true };
		const stats = parseStats(await statsRes.json());
		return { result: stats ? { ...stats, url: film.url } : null, failed: false };
	} catch {
		// Timeout, network error, a body that is not JSON or one of an unexpected shape.
		return { result: null, failed: true };
	}
}

/**
 * The Letterboxd average rating and page of a film, by TMDB id. Null without both keys and for a
 * film Letterboxd does not know or has no average for; `'failed'` on any error, bad answer or
 * timeout. Answers are cached under a key that holds the TMDB id only, never the keys.
 *
 * @param tmdbId - The film's TMDB id.
 * @param inputs - Draws the nonce and timestamp of each request; fixed in tests.
 */
export async function getLetterboxdRating(
	tmdbId: string,
	inputs: SigningInputsFactory = freshInputs
): Promise<LetterboxdOutcome> {
	if (!letterboxdConfigured()) return null;
	const { result, failed } = await getCached<Lookup>(
		`letterboxd:tmdb:${tmdbId}`,
		(l) => (l.failed ? FAILED_TTL_MS : CACHE_TTL_MS),
		() => lookup(tmdbId, inputs)
	);
	return failed ? 'failed' : result;
}
