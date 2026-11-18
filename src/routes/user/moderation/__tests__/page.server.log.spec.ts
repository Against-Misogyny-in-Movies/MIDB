import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const listRecentActions = vi.fn();
const accountIdByUsername = vi.fn();

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/data/moderation-queue.ts', () => ({
	listPendingQueue: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
	listReportedQueue: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
	listRecentActions: (...args: unknown[]) => listRecentActions(...args)
}));
vi.mock('#lib/server/data/account-view.ts', () => ({
	accountIdByUsername: (...args: unknown[]) => accountIdByUsername(...args)
}));
vi.mock('#lib/server/data/moderation-counts.ts', () => ({
	getModerationCounts: async () => ({ pending: 0, reported: 0, held: 0, flagged: 0 })
}));
vi.mock('#lib/server/data/source-sync.ts', () => ({ getSourceSyncDates: async () => ({}) }));

const { load } = await import('../+page.server');

const loadEvent = (search = '') =>
	({ locals: {}, url: new URL(`http://localhost/user/moderation${search}`) }) as Parameters<
		typeof load
	>[0];

const queries = { listRecentActions };

beforeEach(() => {
	requireRole.mockReset().mockResolvedValue({ id: 'mod-1', role: 'moderator' });
	listRecentActions.mockReset().mockResolvedValue({ items: [], nextCursor: null });
	accountIdByUsername.mockReset().mockResolvedValue(null);
});

describe('the log tab’s filters', () => {
	type LogData = {
		recent: unknown;
		logFilters: unknown;
		logParams: string;
		unknownNames: string[];
	};
	const ids: Record<string, string> = { ada_1234: 'ada-id', woolf_2210: 'woolf-id' };

	beforeEach(() => {
		accountIdByUsername.mockImplementation(async (name: string) => ids[name.toLowerCase()] ?? null);
	});

	it('reads the whole log with no filter, and no other tab’s data', async () => {
		const data = (await load(loadEvent('?tab=log'))) as LogData;
		expect(queries.listRecentActions).toHaveBeenCalledExactlyOnceWith(null, undefined, {
			actions: undefined,
			actorId: undefined,
			accountId: undefined
		});
		expect(data).toMatchObject({
			logFilters: { action: null, actor: null, account: null },
			logParams: '',
			unknownNames: []
		});
		expect(accountIdByUsername).not.toHaveBeenCalled();
	});

	it('resolves the two usernames to ids and a group to its actions, and hands the ids on for paging', async () => {
		const data = (await load(
			loadEvent('?tab=log&action=restrictions&actor=ada_1234&account=WOOLF_2210')
		)) as LogData;
		expect(queries.listRecentActions).toHaveBeenCalledExactlyOnceWith(null, undefined, {
			actions: ['mute', 'unmute', 'ban', 'unban'],
			actorId: 'ada-id',
			accountId: 'woolf-id'
		});
		expect(data.logParams).toBe('&action=restrictions&actor=ada-id&account=woolf-id');
		expect(data.logFilters).toEqual({
			action: 'restrictions',
			actor: 'ada_1234',
			account: 'WOOLF_2210'
		});
	});

	it('lists nothing for a name no account has, and names it', async () => {
		const data = (await load(loadEvent('?tab=log&actor=ada_1234&account=nobody_1'))) as LogData;
		expect(queries.listRecentActions).not.toHaveBeenCalled();
		expect(data.recent).toEqual({ items: [], nextCursor: null });
		expect(data.unknownNames).toEqual(['account']);
	});

	it('drops an action it does not know', async () => {
		const data = (await load(loadEvent('?tab=log&action=drop_table'))) as LogData;
		expect(data.logFilters).toMatchObject({ action: null });
		expect(queries.listRecentActions).toHaveBeenCalledOnce();
	});

	it('reads no log filter on another tab', async () => {
		const data = (await load(loadEvent('?tab=pending&actor=ada_1234'))) as LogData;
		expect(data.logFilters).toBeNull();
		expect(accountIdByUsername).not.toHaveBeenCalled();
	});
});
