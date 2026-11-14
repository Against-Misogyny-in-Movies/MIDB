import { error } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn();
const rateLimit = vi.fn();
const purgeTitleComments = vi.fn();
const purgeProfiles = vi.fn();
const actionsFns = {
	approveComment: vi.fn(),
	hideComment: vi.fn(),
	rejectComment: vi.fn(),
	restoreComment: vi.fn(),
	dismissReports: vi.fn(),
	muteUser: vi.fn(),
	banAccount: vi.fn()
};
const queue = {
	listPendingQueue: vi.fn(),
	listReportedQueue: vi.fn(),
	listRecentActions: vi.fn()
};
const reports = {
	approveReport: vi.fn(),
	rejectReport: vi.fn(),
	rejectAccountReports: vi.fn(),
	listHeldReports: vi.fn(),
	listFlaggedTitles: vi.fn(),
	getOpenTitle: vi.fn()
};
const listModerationTable = vi.fn();
const saveScanLabels = vi.fn();
const listScanItems = vi.fn();
const queryToFilters = vi.fn();
const scanComments = vi.fn();
const serverEnv = vi.hoisted(() => ({ ANTHROPIC_API_KEY: undefined as string | undefined }));

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireRole: (...args: unknown[]) => requireRole(...args)
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({
	rateLimit: (...args: unknown[]) => rateLimit(...args)
}));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeTitleComments: (...args: unknown[]) => purgeTitleComments(...args),
	purgeProfile: vi.fn(),
	purgeProfiles: (...args: unknown[]) => purgeProfiles(...args)
}));
vi.mock('#lib/server/env.ts', () => ({ env: serverEnv }));
vi.mock('#lib/server/data/moderation-actions.ts', () => actionsFns);
vi.mock('#lib/server/data/moderation-queue.ts', () => queue);
vi.mock('#lib/server/data/community-report-moderation.ts', () => reports);
vi.mock('#lib/server/data/community-report-queue.ts', () => reports);
vi.mock('#lib/server/data/count-flags.ts', () => ({
	resolveCountFlag: vi.fn(),
	dismissCountFlag: vi.fn()
}));
vi.mock('#lib/server/data/source-sync.ts', () => ({ getSourceSyncDates: async () => ({}) }));
vi.mock('#lib/server/data/moderation-table.ts', () => ({
	listModerationTable: (...args: unknown[]) => listModerationTable(...args)
}));
vi.mock('#lib/server/data/comment-ai-labels.ts', () => ({
	saveScanLabels: (...args: unknown[]) => saveScanLabels(...args),
	listScanItems: (...args: unknown[]) => listScanItems(...args)
}));
vi.mock('#lib/server/moderation/search-filters.ts', () => ({
	queryToFilters: (...args: unknown[]) => queryToFilters(...args)
}));
vi.mock('#lib/server/moderation/scan.ts', () => ({
	scanComments: (...args: unknown[]) => scanComments(...args)
}));

const { load, actions } = await import('../+page.server');

const STAFF = { id: 'mod-1', role: 'moderator' };
const ALIEN = { id: 't1', kind: 'movie', tmdbId: 348, name: 'Alien' };
const DARK = { id: 't2', kind: 'tv', tmdbId: 70523, name: 'Dark' };

const loadEvent = (search: string) =>
	({ locals: {}, url: new URL(`http://localhost/user/moderation${search}`) }) as Parameters<
		typeof load
	>[0];

function run(name: 'aiSearch' | 'scan' | 'bulk', fields: [string, string][]) {
	const form = new FormData();
	for (const [key, value] of fields) form.append(key, value);
	const event = {
		locals: {},
		request: new Request('http://localhost/user/moderation', { method: 'POST', body: form }),
		getClientAddress: () => '203.0.113.7'
	};
	return actions[name](event as unknown as Parameters<(typeof actions)[typeof name]>[0]);
}

/** `n` selected rows, each with the `editedAt` its row showed (none edited). */
const ids = (n: number): [string, string][] =>
	Array.from({ length: n }, (_, i): [string, string][] => [
		['ids', `c${i + 1}`],
		[`editedAt.c${i + 1}`, '']
	]).flat();

beforeEach(() => {
	requireRole.mockReset().mockResolvedValue(STAFF);
	rateLimit.mockReset().mockResolvedValue(undefined);
	purgeTitleComments.mockReset();
	purgeProfiles.mockReset();
	for (const fn of Object.values(actionsFns)) fn.mockReset();
	for (const fn of Object.values(queue)) fn.mockReset().mockResolvedValue([]);
	reports.listHeldReports.mockReset().mockResolvedValue([]);
	reports.listFlaggedTitles.mockReset().mockResolvedValue([]);
	reports.getOpenTitle.mockReset().mockResolvedValue(null);
	listModerationTable.mockReset().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 });
	saveScanLabels.mockReset().mockResolvedValue(undefined);
	listScanItems.mockReset();
	queryToFilters.mockReset();
	scanComments.mockReset();
	serverEnv.ANTHROPIC_API_KEY = undefined;
});

describe('load with ?tab=table', () => {
	it('reads the filters from the URL and returns the table', async () => {
		serverEnv.ANTHROPIC_API_KEY = 'sk-test';
		const table = { rows: [{ id: 'row' }], total: 1, page: 2, pageSize: 50 };
		listModerationTable.mockResolvedValue(table);
		const data = (await load(
			loadEvent('?tab=table&q=troll&status=pending&category=hate&severity=2&page=2')
		)) as Record<string, unknown>;
		expect(listModerationTable).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				q: 'troll',
				status: ['pending'],
				categories: ['hate'],
				minSeverity: 2,
				page: 2,
				sort: 'newest'
			})
		);
		expect(data.table).toBe(table);
		expect(data.filters).toMatchObject({ q: 'troll', page: 2 });
		expect(data.aiAvailable).toBe(true);
		expect(queue.listPendingQueue).toHaveBeenCalled();
	});

	it('says only whether a key exists, never the key', async () => {
		serverEnv.ANTHROPIC_API_KEY = 'sk-secret';
		const data = await load(loadEvent('?tab=table'));
		expect(JSON.stringify(data)).not.toContain('sk-secret');
		serverEnv.ANTHROPIC_API_KEY = undefined;
		expect(((await load(loadEvent('?tab=table'))) as { aiAvailable: boolean }).aiAvailable).toBe(
			false
		);
	});

	it('treats the title filter as a name, not as a title’s community reports', async () => {
		await load(loadEvent('?tab=table&title=Alien'));
		expect(reports.getOpenTitle).not.toHaveBeenCalled();
		expect(listModerationTable).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alien' }));
		const data = (await load(loadEvent('?tab=table&title=Alien'))) as { titleId: string | null };
		expect(data.titleId).toBeNull();
	});

	it('loads no table for any other tab', async () => {
		const data = (await load(loadEvent(''))) as { table: unknown; filters: unknown };
		expect(listModerationTable).not.toHaveBeenCalled();
		expect(data.table).toBeNull();
		expect(data.filters).toBeNull();
	});

	it('reads no table for a reader who is not staff', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(load(loadEvent('?tab=table'))).rejects.toMatchObject({ status: 403 });
		expect(listModerationTable).not.toHaveBeenCalled();
	});
});

describe.each(['aiSearch', 'scan', 'bulk'] as const)('?/%s guards', (name) => {
	const FIELDS: [string, string][] = [
		['query', 'trolling'],
		['concern', 'trolling'],
		['op', 'approve'],
		...ids(1)
	];

	it('answers 403 to a reader who is not staff and does nothing', async () => {
		requireRole.mockImplementation(async () => error(403, 'Forbidden'));
		await expect(run(name, FIELDS)).rejects.toMatchObject({ status: 403 });
		expect(queryToFilters).not.toHaveBeenCalled();
		expect(scanComments).not.toHaveBeenCalled();
		expect(actionsFns.approveComment).not.toHaveBeenCalled();
	});

	it.skipIf(name === 'bulk')(
		'passes a 429 from the rate limit through before any work',
		async () => {
			rateLimit.mockImplementation(async () => error(429, 'Too many requests'));
			await expect(run(name, FIELDS)).rejects.toMatchObject({ status: 429 });
			expect(queryToFilters).not.toHaveBeenCalled();
			expect(scanComments).not.toHaveBeenCalled();
			expect(actionsFns.approveComment).not.toHaveBeenCalled();
		}
	);

	it.skipIf(name !== 'bulk')('applies no rate limit to staff', async () => {
		actionsFns.approveComment.mockResolvedValue({ ok: true, title: null });
		await run(name, FIELDS);
		expect(rateLimit).not.toHaveBeenCalled();
	});
});

describe('?/aiSearch', () => {
	it('limits by the AI bucket for the staff user, and answers with the filters as a query', async () => {
		queryToFilters.mockResolvedValue({
			ok: true,
			filters: { categories: ['trolling'], sort: 'newest', page: 1, from: '2026-11-06' },
			model: 'm'
		});
		const result = await run('aiSearch', [['query', 'trolling this week']]);
		expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_MODERATE_AI', {
			userId: 'mod-1'
		});
		expect(queryToFilters).toHaveBeenCalledWith(
			'trolling this week',
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
		);
		expect(result).toEqual({
			id: 'aiSearch',
			done: 'aiSearch',
			params: 'category=trolling&from=2026-11-06'
		});
	});

	it.each([
		['ai-unavailable', 503],
		['ai-rate-limited', 429],
		['ai-timeout', 502],
		['ai-unparsed', 502],
		['ai-refusal', 502]
	])('maps %s to %i', async (code, status) => {
		queryToFilters.mockResolvedValue({ ok: false, code });
		expect(await run('aiSearch', [['query', 'x']])).toMatchObject({ status });
	});

	it('refuses an empty or over-long query without calling the model', async () => {
		expect(await run('aiSearch', [['query', '  ']])).toMatchObject({ status: 400 });
		expect(await run('aiSearch', [['query', 'x'.repeat(301)]])).toMatchObject({ status: 400 });
		expect(queryToFilters).not.toHaveBeenCalled();
	});
});

describe('?/scan', () => {
	const ITEMS = [
		{ id: 'c1', body: 'First', titleName: 'Alien', kind: 'movie' },
		{ id: 'c3', body: 'Third', titleName: 'Dark', kind: 'tv' }
	];

	beforeEach(() => {
		listScanItems.mockResolvedValue(ITEMS);
	});

	it('scans the stored bodies of the named comments, saves the labels and counts the matches', async () => {
		const results = [
			{ id: 'c1', match: true, categories: [], severity: 2, reason: 'r', model: 'm' },
			{ id: 'c3', match: false, categories: [], severity: 0, reason: 'r', model: 'm' }
		];
		scanComments.mockResolvedValue({ ok: true, results, skipped: 0, model: 'm' });
		const result = await run('scan', [
			['concern', '  disparaging  '],
			['ids', 'c1'],
			['ids', 'c2'],
			['ids', 'c3'],
			['ids', 'c1'],
			['ids', 'gone']
		]);
		expect(rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_MODERATE_AI', {
			userId: 'mod-1'
		});
		expect(listScanItems).toHaveBeenCalledExactlyOnceWith(['c1', 'c2', 'c3', 'gone']);
		expect(scanComments).toHaveBeenCalledExactlyOnceWith('disparaging', ITEMS);
		expect(saveScanLabels).toHaveBeenCalledExactlyOnceWith('mod-1', 'disparaging', results);
		expect(result).toEqual({
			id: 'scan',
			done: 'scan',
			matched: 1,
			checked: 2,
			notChecked: 2
		});
	});

	it('counts the comments the model left out as not checked', async () => {
		scanComments.mockResolvedValue({
			ok: true,
			results: [{ id: 'c1', match: false, categories: [], severity: 0, reason: '', model: 'm' }],
			skipped: 1,
			model: 'm'
		});
		const result = await run('scan', [
			['concern', 'x'],
			['ids', 'c1'],
			['ids', 'c3']
		]);
		expect(result).toMatchObject({ checked: 1, notChecked: 1 });
	});

	it('saves nothing and says why when the scan fails', async () => {
		scanComments.mockResolvedValue({ ok: false, code: 'ai-unavailable' });
		expect(
			await run('scan', [
				['concern', 'x'],
				['ids', 'c1']
			])
		).toMatchObject({ status: 503 });
		scanComments.mockResolvedValue({ ok: false, code: 'invalid-concern' });
		expect(
			await run('scan', [
				['concern', 'x'.repeat(201)],
				['ids', 'c1']
			])
		).toMatchObject({ status: 400 });
		expect(saveScanLabels).not.toHaveBeenCalled();
	});

	it('refuses a scan with no concern, no ids or more than a page', async () => {
		expect(await run('scan', [['ids', 'c1']])).toMatchObject({ status: 400 });
		expect(await run('scan', [['concern', 'x']])).toMatchObject({ status: 400 });
		expect(await run('scan', [['concern', 'x'], ...ids(51)])).toMatchObject({ status: 400 });
		expect(scanComments).not.toHaveBeenCalled();
		expect(listScanItems).not.toHaveBeenCalled();
	});

	it('refuses a concern over the limit before reading any comment', async () => {
		expect(await run('scan', [['concern', 'x'.repeat(201)], ...ids(1)])).toMatchObject({
			status: 400,
			data: { error: 'The scan text must be 1 to 200 characters.' }
		});
		expect(listScanItems).not.toHaveBeenCalled();
		expect(scanComments).not.toHaveBeenCalled();
	});
});

describe('?/bulk', () => {
	it('applies the operation to each comment, purges each title once and counts both outcomes', async () => {
		actionsFns.hideComment
			.mockResolvedValueOnce({ ok: true, title: ALIEN })
			.mockResolvedValueOnce({ ok: true, title: ALIEN })
			.mockResolvedValueOnce({ ok: false, reason: 'edited' })
			.mockResolvedValueOnce({ ok: true, title: DARK })
			.mockResolvedValueOnce({ ok: false, reason: 'invalid-state' });
		const result = await run('bulk', [
			['op', 'hide'],
			['reason', '  Off topic  '],
			['ids', 'c1'],
			['ids', 'c2'],
			['ids', 'c3'],
			['ids', 'c4'],
			['ids', 'c5'],
			['ids', 'c1']
		]);
		expect(rateLimit).not.toHaveBeenCalled();
		expect(actionsFns.hideComment.mock.calls.map(([, id, reason]) => [id, reason])).toEqual([
			['c1', 'Off topic'],
			['c2', 'Off topic'],
			['c3', 'Off topic'],
			['c4', 'Off topic'],
			['c5', 'Off topic']
		]);
		expect(actionsFns.hideComment.mock.calls[0][0]).toBe(STAFF);
		expect(purgeTitleComments).toHaveBeenCalledTimes(2);
		expect(purgeTitleComments).toHaveBeenCalledWith(ALIEN);
		expect(purgeTitleComments).toHaveBeenCalledWith(DARK);
		expect(result).toMatchObject({ done: 'bulk', op: 'hide', applied: 3, refused: 2, edited: 1 });
	});

	it.each([
		['approve', 'approveComment'],
		['restore', 'restoreComment'],
		['dismiss', 'dismissReports'],
		['reject', 'rejectComment']
	] as const)('%s calls %s', async (op, fn) => {
		actionsFns[fn].mockResolvedValue({ ok: true, title: ALIEN });
		await run('bulk', [['op', op], ...ids(2)]);
		expect(actionsFns[fn]).toHaveBeenCalledTimes(2);
		expect(purgeTitleComments).toHaveBeenCalledExactlyOnceWith(ALIEN);
	});

	it('passes each row its own editedAt to the operations that publish', async () => {
		for (const fn of ['approveComment', 'restoreComment', 'dismissReports'] as const) {
			actionsFns[fn].mockResolvedValue({ ok: true, title: null });
		}
		const rows: [string, string][] = [
			['ids', 'c1'],
			['editedAt.c1', ''],
			['ids', 'c2'],
			['editedAt.c2', '1762077600000']
		];
		for (const [op, fn] of [
			['approve', 'approveComment'],
			['restore', 'restoreComment'],
			['dismiss', 'dismissReports']
		] as const) {
			await run('bulk', [['op', op], ...rows]);
			expect(actionsFns[fn].mock.calls.map((c) => [c[1], c[2]])).toEqual([
				['c1', null],
				['c2', 1762077600000]
			]);
		}
	});

	it('refuses a row with no editedAt for an operation that publishes, and runs the others', async () => {
		actionsFns.approveComment.mockResolvedValue({ ok: true, title: null });
		const result = await run('bulk', [
			['op', 'approve'],
			['ids', 'c1'],
			['ids', 'c2'],
			['editedAt.c2', '']
		]);
		expect(actionsFns.approveComment).toHaveBeenCalledExactlyOnceWith(STAFF, 'c2', null);
		expect(result).toMatchObject({ applied: 1, refused: 1 });
	});

	it('needs no editedAt to hide or reject', async () => {
		actionsFns.hideComment.mockResolvedValue({ ok: true, title: null });
		await run('bulk', [
			['op', 'hide'],
			['ids', 'c1']
		]);
		expect(actionsFns.hideComment).toHaveBeenCalledOnce();
	});

	it('answers 409 with the bulk refusal, and purges nothing, when no comment could change', async () => {
		actionsFns.approveComment.mockResolvedValue({ ok: false, reason: 'invalid-state' });
		expect(await run('bulk', [['op', 'approve'], ...ids(2)])).toMatchObject({
			status: 409,
			data: {
				id: 'bulk',
				error:
					'None of the selected comments could be changed: none is in a status this action applies to.'
			}
		});
		expect(purgeTitleComments).not.toHaveBeenCalled();
	});

	it('purges the titles already changed when a later write throws, and the error reaches the caller', async () => {
		actionsFns.hideComment
			.mockResolvedValueOnce({ ok: true, title: ALIEN })
			.mockResolvedValueOnce({ ok: true, title: DARK })
			.mockRejectedValueOnce(new Error('D1 down'));
		await expect(run('bulk', [['op', 'hide'], ...ids(4)])).rejects.toThrow('D1 down');
		expect(actionsFns.hideComment).toHaveBeenCalledTimes(3);
		expect(purgeTitleComments).toHaveBeenCalledTimes(2);
		expect(purgeTitleComments).toHaveBeenCalledWith(ALIEN);
		expect(purgeTitleComments).toHaveBeenCalledWith(DARK);
	});

	it('purges each author’s profile once, also when a later write throws', async () => {
		actionsFns.hideComment
			.mockResolvedValueOnce({ ok: true, title: ALIEN, authorId: 'a1' })
			.mockResolvedValueOnce({ ok: true, title: ALIEN, authorId: 'a1' })
			.mockResolvedValueOnce({ ok: true, title: DARK, authorId: 'a2' })
			.mockRejectedValueOnce(new Error('D1 down'));
		await expect(run('bulk', [['op', 'hide'], ...ids(4)])).rejects.toThrow('D1 down');
		expect(purgeProfiles).toHaveBeenCalledOnce();
		expect([...(purgeProfiles.mock.calls[0][0] as Set<string>)]).toEqual(['a1', 'a2']);
	});

	it('also purges the profiles of the authors of the published replies', async () => {
		actionsFns.hideComment
			.mockResolvedValueOnce({ ok: true, title: ALIEN, authorId: 'a1', replyAuthorIds: ['r1'] })
			.mockResolvedValueOnce({
				ok: true,
				title: DARK,
				authorId: 'a2',
				replyAuthorIds: ['r1', 'r2']
			});
		await run('bulk', [['op', 'hide'], ...ids(2)]);
		expect([...(purgeProfiles.mock.calls[0][0] as Set<string>)]).toEqual(['a1', 'r1', 'a2', 'r2']);
	});

	it('purges no title for a comment with none', async () => {
		actionsFns.dismissReports.mockResolvedValue({ ok: true, title: null });
		await run('bulk', [['op', 'dismiss'], ...ids(1)]);
		expect(purgeTitleComments).not.toHaveBeenCalled();
	});

	it('refuses an unknown operation, no ids and more than a page before changing anything', async () => {
		expect(await run('bulk', [['op', 'ban'], ...ids(1)])).toMatchObject({ status: 400 });
		expect(await run('bulk', [['op', 'toString'], ...ids(1)])).toMatchObject({ status: 400 });
		expect(await run('bulk', [['op', 'approve']])).toMatchObject({ status: 400 });
		expect(await run('bulk', [['op', 'approve'], ...ids(51)])).toMatchObject({ status: 400 });
		for (const fn of Object.values(actionsFns)) expect(fn).not.toHaveBeenCalled();
	});

	it('accepts a full page', async () => {
		actionsFns.approveComment.mockResolvedValue({ ok: true, title: ALIEN });
		const result = await run('bulk', [['op', 'approve'], ...ids(50)]);
		expect(result).toMatchObject({ applied: 50, refused: 0 });
		expect(purgeTitleComments).toHaveBeenCalledOnce();
	});
});
