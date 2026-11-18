import { beforeEach, describe, expect, it, vi } from 'vitest';
import { error, isHttpError } from '@sveltejs/kit';
import { encodeQueueCursor } from '#lib/server/data/queue-cursor.ts';

const requireRole = vi.fn();
const lists = {
	listPendingQueue: vi.fn(),
	listReportedQueue: vi.fn(),
	listRecentActions: vi.fn(),
	listHeldReports: vi.fn(),
	listFlaggedTitles: vi.fn()
};
vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/data/moderation-queue.ts', () => lists);
vi.mock('#lib/server/data/community-report-queue.ts', () => lists);

const route = await import('../+server');

const PAGE = { items: [{ id: 'x' }], nextCursor: null };
const SHAPES = {
	pending: encodeQueueCursor([4, 1, 1, 'c1']),
	reported: encodeQueueCursor([4, 2, 1, 'c1']),
	held: encodeQueueCursor([1, 'u1', 't1']),
	flagged: encodeQueueCursor([2, 1, 't1']),
	log: encodeQueueCursor([1, 'a1'])
};
const FN = {
	pending: lists.listPendingQueue,
	reported: lists.listReportedQueue,
	held: lists.listHeldReports,
	flagged: lists.listFlaggedTitles,
	log: lists.listRecentActions
};

const get = async (query: string) =>
	await route.GET({
		locals: {},
		url: new URL(`http://localhost/api/moderation/queue${query}`)
	} as never);

async function status(promise: Promise<Response>): Promise<number> {
	try {
		return (await promise).status;
	} catch (err) {
		if (isHttpError(err)) return err.status;
		throw err;
	}
}

beforeEach(() => {
	requireRole.mockReset().mockResolvedValue({ id: 'mod', role: 'moderator' });
	for (const fn of Object.values(lists)) fn.mockReset().mockResolvedValue(PAGE);
});

describe('GET /api/moderation/queue', () => {
	it.each(Object.entries(SHAPES))(
		'answers the next page of %s, private and uncached',
		async (queue, cursor) => {
			const res = await get(`?queue=${queue}&cursor=${cursor}`);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual(PAGE);
			expect(res.headers.get('cache-control')).toBe('private, no-store');
			const expected = queue === 'log' ? [cursor, undefined, {}] : [cursor];
			expect(FN[queue as keyof typeof FN]).toHaveBeenCalledExactlyOnceWith(...expected);
		}
	);

	it('narrows the log to an account, and takes the account for no other list', async () => {
		await get(`?queue=log&cursor=${SHAPES.log}&account=acct-1`);
		expect(lists.listRecentActions).toHaveBeenCalledExactlyOnceWith(SHAPES.log, undefined, {
			accountId: 'acct-1'
		});
		await get(`?queue=pending&cursor=${SHAPES.pending}&account=acct-1`);
		expect(lists.listPendingQueue).toHaveBeenCalledExactlyOnceWith(SHAPES.pending);
		expect(await status(get(`?queue=log&cursor=${SHAPES.log}&account=a%20b`))).toBe(400);
	});

	it('narrows the log by action, group and staff member, and refuses an action it does not know', async () => {
		await get(`?queue=log&cursor=${SHAPES.log}&action=restrictions&actor=ada-id&account=acct-1`);
		expect(lists.listRecentActions).toHaveBeenCalledExactlyOnceWith(SHAPES.log, undefined, {
			accountId: 'acct-1',
			actorId: 'ada-id',
			actions: ['mute', 'unmute', 'ban', 'unban']
		});
		lists.listRecentActions.mockClear();
		await get(`?queue=log&cursor=${SHAPES.log}&action=hide`);
		expect(lists.listRecentActions).toHaveBeenCalledWith(SHAPES.log, undefined, {
			actions: ['hide']
		});
		expect(await status(get(`?queue=log&cursor=${SHAPES.log}&action=drop`))).toBe(400);
		expect(await status(get(`?queue=log&cursor=${SHAPES.log}&actor=a%20b`))).toBe(400);
	});

	it('runs the staff guard without a page redirect, before reading anything', async () => {
		await get(`?queue=pending&cursor=${SHAPES.pending}`);
		expect(requireRole).toHaveBeenCalledWith({}, ['moderator', 'administrator']);
	});

	it('answers 403 to a reader who is not staff and 401 to a signed-out one, reading nothing', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		expect(await status(get(`?queue=pending&cursor=${SHAPES.pending}`))).toBe(403);
		requireRole.mockImplementation(async () => error(401, 'Unauthorized'));
		expect(await status(get(`?queue=pending&cursor=${SHAPES.pending}`))).toBe(401);
		for (const fn of Object.values(lists)) expect(fn).not.toHaveBeenCalled();
	});

	it('answers 400 for an unknown queue, a missing cursor, or a cursor another list made', async () => {
		expect(await status(get(`?queue=table&cursor=${SHAPES.pending}`))).toBe(400);
		expect(await status(get('?queue=pending'))).toBe(400);
		expect(await status(get('?queue=pending&cursor=not-a-cursor'))).toBe(400);
		expect(await status(get(`?queue=pending&cursor=${SHAPES.held}`))).toBe(400);
		expect(await status(get(`?queue=held&cursor=${'a'.repeat(201)}`))).toBe(400);
		for (const fn of Object.values(lists)) expect(fn).not.toHaveBeenCalled();
	});
});
