import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { communityContentReports, titleCountFlags } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';
import type { ReportCounts, ViewerReportResponse } from '#lib/media/types/community-reports.ts';

const resolveWriteRef = vi.fn();
const resolveCommentTitle = vi.fn();
vi.mock('#lib/server/data/comment-title.ts', async () => {
	const { error } = await import('@sveltejs/kit');
	return {
		resolveWriteRef,
		resolveCommentTitle,
		findCommentTitle: async (kind: string, tmdbId: string) => {
			const { db } = await import('#lib/server/db.ts');
			const { titles } = await import('#db/schema/titles.ts');
			const { and, eq } = await import('drizzle-orm');
			return (
				(await db.query.titles.findFirst({
					where: and(eq(titles.kind, kind as 'movie'), eq(titles.tmdbId, Number(tmdbId)))
				})) ?? null
			);
		},
		parseTitleParams: (kind: string, tmdbId: string) => {
			if ((kind !== 'movie' && kind !== 'tv') || !/^\d{1,9}$/.test(tmdbId))
				error(404, 'Title not found');
			return { kind, tmdbId: String(Number(tmdbId)) };
		}
	};
});

const reports = await import('../routes/api/titles/[kind]/[tmdbId]/reports/+server');
const viewer = await import('../routes/api/titles/[kind]/[tmdbId]/reports/viewer/+server');
const flag = await import('../routes/api/titles/[kind]/[tmdbId]/reports/flag/+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

type Handler = (e: never) => Promise<Response> | Response;
const DAY = 86_400_000;
const params = { kind: 'movie', tmdbId: '348' };

let title: TitleRow;
let reader: UserRow;
const asUser = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];

async function call(
	handler: Handler,
	{
		method = 'GET',
		body,
		rawBody,
		user = reader,
		params: routeParams = params
	}: {
		method?: string;
		body?: unknown;
		rawBody?: string;
		user?: UserRow | null;
		params?: { kind: string; tmdbId: string };
	} = {}
): Promise<Response> {
	const event = {
		params: routeParams,
		url: new URL('http://localhost/api/x'),
		request: new Request('http://localhost/api/x', {
			method,
			body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
			headers: { 'content-type': 'application/json' }
		}),
		locals: { getUser: async () => user },
		getClientAddress: () => '203.0.113.9'
	} as unknown as RequestEvent;
	try {
		return await handler(event as never);
	} catch (err) {
		const e = err as { status?: number };
		if (typeof e.status === 'number') return new Response(null, { status: e.status });
		throw err;
	}
}

const answers = {
	watched: true,
	sexualPresent: 'present',
	partnerLevel: 'mentioned',
	physicalLevel: null,
	flags: { rapeOnScreen: true }
};
const put = (extra: object = {}, options = {}) =>
	call(reports.PUT, { method: 'PUT', body: { ...answers, ...extra }, ...options });
const stored = () => db.select().from(communityContentReports);

beforeEach(async () => {
	resetCloudflareStub();
	await clearCache();
	resolveWriteRef.mockReset();
	resolveCommentTitle.mockReset();
	const old = new Date(Date.now() - 30 * DAY);
	await db.insert(users).values(userValues('reader', { createdAt: old }));
	reader = await asUser('reader');
	[title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	resolveWriteRef.mockResolvedValue({
		title: 'Alien',
		imdbId: null,
		tmdbId: '348',
		releaseDate: '1979-05-25'
	});
	resolveCommentTitle.mockResolvedValue(title);
});

describe('guards', () => {
	it('answers 401 signed out (a banned account is signed out by the hook) on every route', async () => {
		const calls = [
			call(viewer.GET, { user: null }),
			call(reports.PUT, { method: 'PUT', body: answers, user: null }),
			call(reports.DELETE, { method: 'DELETE', user: null }),
			call(flag.POST, { method: 'POST', body: {}, user: null })
		];
		expect((await Promise.all(calls)).map((r) => r.status)).toEqual([401, 401, 401, 401]);
		expect(await stored()).toEqual([]);
	});

	it('answers 403 for a muted account on every write, and stores nothing', async () => {
		const muted = { ...reader, mutedUntil: new Date(Date.now() + 60_000) } as UserRow;
		const calls = [
			call(reports.PUT, { method: 'PUT', body: answers, user: muted }),
			call(reports.DELETE, { method: 'DELETE', user: muted }),
			call(flag.POST, { method: 'POST', body: {}, user: muted })
		];
		expect((await Promise.all(calls)).map((r) => r.status)).toEqual([403, 403, 403]);
		expect(await stored()).toEqual([]);
		expect(await db.select().from(titleCountFlags)).toEqual([]);
	});

	it('answers 404 for a bad kind or id', async () => {
		for (const p of [
			{ kind: 'book', tmdbId: '1' },
			{ kind: 'movie', tmdbId: 'abc' }
		])
			expect((await call(reports.GET, { params: p })).status).toBe(404);
	});

	it('answers 429 past the content-report limit, per user', async () => {
		for (let i = 0; i < 10; i++) expect((await put()).status).toBe(200);
		expect((await put()).status).toBe(429);
	});
});

describe('staff and the write limits', () => {
	it('does not rate-limit a moderator on the report writes, and still refuses a mute', async () => {
		await db
			.insert(users)
			.values(userValues('mod', { role: 'moderator', createdAt: new Date(Date.now() - DAY) }));
		const mod = await asUser('mod');
		for (let i = 0; i < 12; i++) expect((await put({}, { user: mod })).status).toBe(200);
		for (let i = 0; i < 12; i++)
			expect((await call(flag.POST, { method: 'POST', body: {}, user: mod })).status).toBe(200);
		for (let i = 0; i < 12; i++)
			expect((await call(reports.DELETE, { method: 'DELETE', user: mod })).status).toBe(204);
		const muted = { ...mod, mutedUntil: new Date(Date.now() + 60_000) } as UserRow;
		expect((await put({}, { user: muted })).status).toBe(403);
	});
});

describe('PUT a report', () => {
	it('stores the answers, answers the status and purges the counts tag and the reader’s profile', async () => {
		const res = await put();
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({ status: 'counted', holdReason: null });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: ['reports:movie:348'] }, { tags: ['profile:reader'] }]);
		expect(await stored()).toMatchObject([
			{ userId: 'reader', titleId: title.id, sexualPresent: 'present', rapeOnScreen: true }
		]);
	});

	it('replaces the reader’s report on a second call', async () => {
		await put();
		await put({ partnerLevel: 'on_screen' });
		expect(await stored()).toMatchObject([{ partnerLevel: 'on_screen' }]);
	});

	it('answers the hold status when the report is held', async () => {
		for (let i = 0; i < 4; i++) {
			await db.insert(users).values(userValues(`o${i}`));
			await db
				.insert(communityContentReports)
				.values({ userId: `o${i}`, titleId: title.id, status: 'counted' });
		}
		const res = await put();
		expect(await res.json()).toEqual({ status: 'held', holdReason: 'burst' });
	});

	it('answers 400 for a malformed or invalid body, after the guards, and stores nothing', async () => {
		expect((await put({}, { rawBody: '{nope', body: undefined })).status).toBe(400);
		for (const extra of [
			{ watched: false },
			{ watched: undefined },
			{ sexualPresent: 'maybe' },
			{ partnerLevel: 'sometimes' },
			{ objectificationLevel: 'on_screen' },
			{ framing: 'celebrated' },
			{ flags: { rapeOnScreen: 'yes' } },
			{ sexualPresent: 'none', flags: { rapeOnScreen: true } }
		])
			expect((await put(extra)).status, JSON.stringify(extra)).toBe(400);
		expect(await stored()).toEqual([]);
		expect(await db.select().from(titles)).toHaveLength(1);
		expect(purgeCalls).toEqual([]);
	});

	it('creates no title row when a refused PUT is the first write for a title', async () => {
		await db.delete(titles).where(eq(titles.id, title.id));
		expect((await put({ watched: false })).status).toBe(400);
		expect(await db.select().from(titles)).toEqual([]);
		expect(await stored()).toEqual([]);
	});

	it('treats absent or null answers as not sure and drops flags unless sexual violence is present', async () => {
		await put({ sexualPresent: null, partnerLevel: undefined, flags: { rapeOnScreen: true } });
		expect(await stored()).toMatchObject([
			{ sexualPresent: null, partnerLevel: null, rapeOnScreen: null }
		]);
	});
});

describe('DELETE a report', () => {
	it('withdraws it, answers 204 and purges the counts and the profile only when there was one', async () => {
		await put();
		purgeCalls.length = 0;
		const res = await call(reports.DELETE, { method: 'DELETE' });
		expect(res.status).toBe(204);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: ['reports:movie:348'] }, { tags: ['profile:reader'] }]);
		expect(await stored()).toEqual([]);

		purgeCalls.length = 0;
		expect((await call(reports.DELETE, { method: 'DELETE' })).status).toBe(204);
		expect(purgeCalls).toEqual([]);
	});
});

describe('GET the viewer report', () => {
	it('is private, no-store, and answers the reader’s own report with its status', async () => {
		let res = await call(viewer.GET);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({ report: null, mutedUntil: null });
		await put();
		res = await call(viewer.GET);
		const json: ViewerReportResponse = await res.json();
		expect(json.report).toMatchObject({
			status: 'counted',
			holdReason: null,
			partnerLevel: 'mentioned'
		});
		expect(json.report?.countsFrom).toBeTypeOf('string');
		expect(json.report).not.toHaveProperty('userId');
	});
});

describe('GET the public counts', () => {
	it('answers a zero total with the public headers for a title with no row', async () => {
		await db.delete(titles).where(eq(titles.id, title.id));
		const res = await call(reports.GET);
		expect(await res.json()).toEqual({ total: 0 });
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cache-tag')).toBe('reports:movie:348');
	});

	it('tags a padded id path with the same tag a write purges', async () => {
		const res = await call(reports.GET, { params: { kind: 'movie', tmdbId: '0348' } });
		expect(res.headers.get('cache-tag')).toBe('reports:movie:348');
		await put();
		expect(purgeCalls).toEqual([{ tags: ['reports:movie:348'] }, { tags: ['profile:reader'] }]);
	});

	it('answers the total only below the minimum, then the counts, and never reads the user', async () => {
		const getUser = vi.fn();
		const get = () =>
			(reports.GET as Handler)({
				params,
				locals: { getUser },
				url: new URL('http://localhost/x')
			} as never) as Promise<Response>;
		for (let i = 0; i < 2; i++) {
			await db.insert(users).values(userValues(`c${i}`, { createdAt: new Date(0) }));
			await db
				.insert(communityContentReports)
				.values({ userId: `c${i}`, titleId: title.id, status: 'counted', framing: 'condemned' });
		}
		let res = await get();
		expect(await res.json()).toEqual({ total: 2 });
		expect(res.headers.get('cdn-cache-control')).toBe('max-age=600, stale-while-revalidate=60');

		await db.insert(users).values(userValues('c2', { createdAt: new Date(0) }));
		await db
			.insert(communityContentReports)
			.values({ userId: 'c2', titleId: title.id, status: 'counted', framing: 'condemned' });
		res = await get();
		const json = (await res.json()) as { total: number } & ReportCounts;
		expect(json.total).toBe(3);
		expect(json.framing.condemned).toBe(3);
		expect(json.categories.sexual).toBeDefined();
		expect(getUser).not.toHaveBeenCalled();
	});
});

describe('POST a counts flag', () => {
	const post = (note?: string | null, options = {}) =>
		call(flag.POST, { method: 'POST', body: note === undefined ? {} : { note }, ...options });

	it('stores one flag per account per title and re-opens it with the new note', async () => {
		expect((await post('Too low')).status).toBe(200);
		await db.update(titleCountFlags).set({ status: 'dismissed' });
		expect((await post('Still wrong')).status).toBe(200);
		expect(await db.select().from(titleCountFlags)).toMatchObject([
			{ titleId: title.id, reporterId: 'reader', note: 'Still wrong', status: 'open' }
		]);
		expect(purgeCalls).toEqual([]);
	});

	it('takes no note, and refuses one that is too long', async () => {
		expect((await post()).status).toBe(200);
		expect((await post('x'.repeat(2000))).status).toBe(400);
		expect(await db.select().from(titleCountFlags)).toMatchObject([{ note: null }]);
	});
});
