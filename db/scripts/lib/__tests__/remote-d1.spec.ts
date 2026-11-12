import { describe, it, expect, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { createRemoteCallbacks, createRemoteDb } from '../remote-d1.ts';

const ENV = {
	CLOUDFLARE_ACCOUNT_ID: 'acct',
	CLOUDFLARE_D1_DATABASE_ID: 'dbid',
	CLOUDFLARE_API_TOKEN: 'tok'
};

function reply(body: unknown, status = 200) {
	return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const ok = (...rows: unknown[][][]) => ({
	success: true,
	errors: [],
	result: rows.map((r) => ({ results: { columns: [], rows: r }, success: true }))
});

describe('remote D1 callbacks', () => {
	it('posts one statement to the raw endpoint with the bearer token', async () => {
		const fetchMock = reply(ok([[1, 'a']]));
		const { single } = createRemoteCallbacks(ENV, fetchMock);
		const out = await single('select ?', [7], 'all');
		expect(out).toEqual({ rows: [[1, 'a']] });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/d1/database/dbid/raw');
		expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
		expect(JSON.parse(init.body as string)).toEqual({ sql: 'select ?', params: [7] });
	});

	it('maps get to the first row and run to no rows', async () => {
		const fetchMock = reply(ok([[1], [2]]));
		const { single } = createRemoteCallbacks(ENV, fetchMock);
		expect(await single('s', [], 'get')).toEqual({ rows: [1] });
		expect(await single('s', [], 'run')).toEqual({ rows: [] });
		expect(await single('s', [], 'values')).toEqual({ rows: [[1], [2]] });
	});

	it('posts a batch and maps each result by its method', async () => {
		const fetchMock = reply(ok([[1]], [[2, 3]]));
		const { batch } = createRemoteCallbacks(ENV, fetchMock);
		const out = await batch([
			{ sql: 'a', params: [1], method: 'get' },
			{ sql: 'b', params: [], method: 'all' }
		]);
		expect(out).toEqual([{ rows: [1] }, { rows: [[2, 3]] }]);
		const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
		expect(JSON.parse(init.body as string)).toEqual({
			batch: [
				{ sql: 'a', params: [1] },
				{ sql: 'b', params: [] }
			]
		});
	});

	it('throws with the API error message', async () => {
		const fetchMock = reply(
			{ success: false, errors: [{ code: 7500, message: 'no such table' }] },
			400
		);
		const { single } = createRemoteCallbacks(ENV, fetchMock);
		await expect(single('s', [], 'all')).rejects.toThrow('no such table');
	});

	it('names the three variables when credentials are missing', () => {
		expect(() => createRemoteCallbacks({ CLOUDFLARE_ACCOUNT_ID: 'a' })).toThrow(
			/CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN/
		);
	});

	it('drives a Drizzle client, including db.batch', async () => {
		const fetchMock = reply(ok([[41]], [[42]]));
		const db = createRemoteDb(ENV, fetchMock);
		const out = await db.batch([db.all(sql`select 41`), db.all(sql`select 42`)]);
		expect(out).toEqual([[[41]], [[42]]]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
