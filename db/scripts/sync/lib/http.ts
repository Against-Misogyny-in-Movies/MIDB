/** Sent with every request to a source, so its operators can see who is reading and why. */
export const USER_AGENT = 'MIDB-sync (+https://github.com/Against-Misogyny-in-Movies/MIDB)';

const RETRY_DELAY_MS = 2000;

export interface FetchOptions {
	/** Abort after this long, the body included. */
	timeoutMs: number;
	/** A 404 returns null instead of throwing. */
	notFoundIsNull?: boolean;
	/** Sent with the User-Agent. */
	headers?: Record<string, string>;
	fetchImpl?: typeof fetch;
	retryDelayMs?: number;
}

/**
 * One GET with the sync's User-Agent, a timeout and one retry on a network error, a 429 or a
 * 5xx. Any other failure throws, so a job that cannot read its source stops without writing.
 */
export async function fetchSource(url: string, options: FetchOptions): Promise<Response | null> {
	const {
		timeoutMs,
		notFoundIsNull = false,
		headers = {},
		fetchImpl = fetch,
		retryDelayMs = RETRY_DELAY_MS
	} = options;
	let lastError: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		try {
			const res = await fetchImpl(url, {
				headers: { ...headers, 'User-Agent': USER_AGENT },
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (res.status === 404 && notFoundIsNull) {
				await res.body?.cancel();
				return null;
			}
			if (res.ok) return res;
			await res.body?.cancel();
			lastError = new Error(`${url} answered ${res.status}`);
			if (res.status !== 429 && res.status < 500) break;
		} catch (error) {
			lastError = error;
		}
	}
	throw new Error(`Could not read ${url}`, { cause: lastError });
}
