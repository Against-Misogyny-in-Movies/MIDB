import { describe, expect, it } from 'vitest';
import { moderationAction } from '#lib/media/utils/comments.ts';
import {
	LOG_ACTION_GROUPS,
	LOG_ACTION_LABELS,
	logActionLabel,
	logActionsOf,
	logChips,
	logHref,
	parseLogFilters
} from '../moderationLog.ts';

const params = (query: string) => new URLSearchParams(query);

describe('the log’s action groups', () => {
	it('hold every action exactly once, and every action has a label', () => {
		const grouped = LOG_ACTION_GROUPS.flatMap((g) => g.actions).sort();
		expect(grouped).toEqual([...moderationAction].sort());
		expect(Object.keys(LOG_ACTION_LABELS).sort()).toEqual([...moderationAction].sort());
	});

	it('are the four the filter offers', () => {
		expect(LOG_ACTION_GROUPS.map((g) => g.label)).toEqual([
			'Comments',
			'Mutes and bans',
			'Community reports and flags',
			'Roles and notes'
		]);
	});
});

describe('logActionsOf', () => {
	it('is a group’s actions for its id and one action for an action’s name', () => {
		expect(logActionsOf('roles')).toEqual(['set_role', 'note']);
		expect(logActionsOf('unban')).toEqual(['unban']);
		expect(logActionsOf('comments')).toHaveLength(5);
	});

	it('is null for none, an unknown value or an inherited property name', () => {
		for (const value of [null, '', 'nope', 'constructor', 'toString']) {
			expect(logActionsOf(value)).toBeNull();
		}
	});
});

describe('parseLogFilters', () => {
	it('reads the three filters, trimmed', () => {
		expect(parseLogFilters(params('action=ban&actor=%20ada_1234%20&account=woolf_2210'))).toEqual({
			action: 'ban',
			actor: 'ada_1234',
			account: 'woolf_2210'
		});
	});

	it('drops an unknown action and empty names, and cuts a long name', () => {
		expect(parseLogFilters(params('action=zzz&actor=&account=' + 'x'.repeat(80)))).toEqual({
			action: null,
			actor: null,
			account: 'x'.repeat(32)
		});
	});
});

describe('logHref and logChips', () => {
	it('builds the log’s address with only the filters that are set', () => {
		expect(logHref({ action: null, actor: null, account: null })).toBe('?tab=log');
		expect(logHref({ action: 'hide', actor: 'ada', account: 'bo' })).toBe(
			'?tab=log&action=hide&actor=ada&account=bo'
		);
	});

	it('has one chip per filter whose link takes off just that filter', () => {
		const chips = logChips({ action: 'hide', actor: 'ada', account: 'bo' });
		expect(chips.map((c) => [c.label, c.href])).toEqual([
			['Action: Hide comment', '?tab=log&actor=ada&account=bo'],
			['Staff: ada', '?tab=log&action=hide&account=bo'],
			['Account: bo', '?tab=log&action=hide&actor=ada']
		]);
		expect(logChips({ action: null, actor: null, account: null })).toEqual([]);
	});

	it('names a group by its label', () => {
		expect(logActionLabel('restrictions')).toBe('Mutes and bans');
		expect(logActionLabel('nope')).toBeNull();
	});
});
