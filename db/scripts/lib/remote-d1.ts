import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { AsyncBatchRemoteCallback, AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../schema/index.ts';
import type { Db } from '../../client.ts';

export const REMOTE_ENV_VARS = [
	'CLOUDFLARE_ACCOUNT_ID',
	'CLOUDFLARE_D1_DATABASE_ID',
	'CLOUDFLARE_API_TOKEN'
] as const;

type Env = Partial<Record<string, string | undefined>>;
type Fetch = typeof fetch;

interface RawResult {
	results?: { columns?: string[]; rows?: unknown[][] };
}
interface RawResponse {
	success?: boolean;
	errors?: { code?: number; message?: string }[];
	result?: RawResult[];
}

/**
 * Drizzle callbacks over D1's REST `raw` endpoint, which takes `{ sql, params }` (one statement)
 * or `{ batch: [...] }` and returns each statement's rows as positional arrays. The request and
 * response shapes follow Cloudflare's API reference; they are exercised with a mocked `fetch`
 * only, never against a live account.
 */
export function createRemoteCallbacks(env: Env, fetchImpl: Fetch = fetch) {
	const missing = REMOTE_ENV_VARS.filter((name) => !env[name]);
	if (missing.length > 0) {
		throw new Error(
			`--remote needs ${REMOTE_ENV_VARS.join(', ')}; missing: ${missing.join(', ')}.`
		);
	}
	const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_D1_DATABASE_ID}/raw`;

	async function post(body: unknown): Promise<RawResult[]> {
		const res = await fetchImpl(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});
		let payload: RawResponse | undefined;
		try {
			payload = (await res.json()) as RawResponse;
		} catch {
			payload = undefined;
		}
		if (!res.ok || !payload?.success) {
			const message =
				payload?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status} ${res.statusText}`;
			throw new Error(`D1 request failed: ${message}`);
		}
		return payload.result ?? [];
	}

	const shape = (result: RawResult | undefined, method: string): { rows: unknown[] } => {
		const rows = result?.results?.rows ?? [];
		if (method === 'run') return { rows: [] };
		if (method === 'get') return { rows: rows[0] };
		return { rows };
	};

	const single: AsyncRemoteCallback = async (sql, params, method) => {
		const [result] = await post({ sql, params });
		return shape(result, method);
	};

	const batch: AsyncBatchRemoteCallback = async (queries) => {
		const results = await post({ batch: queries.map(({ sql, params }) => ({ sql, params })) });
		return queries.map((q, i) => shape(results[i], q.method));
	};

	return { single, batch };
}

/** A Drizzle client over the remote D1 database, from the `CLOUDFLARE_*` variables. */
export function createRemoteDb(env: Env, fetchImpl?: Fetch): Db {
	const { single, batch } = createRemoteCallbacks(env, fetchImpl);
	return drizzle(single, batch, { schema });
}
