import { describe, it, expect } from 'vitest';
import { MODERATION_REASON_MAX } from '#lib/media/utils/comments.ts';
import { BLOCKLIST_TERMS } from '../blocklist.ts';
import { applyPolicy, BLOCKLIST_REASON, blocklistReason, REJECT_MIN_SEVERITY } from '../policy.ts';
import type { Verdict } from '../verdict.ts';

const verdict = (over: Partial<Verdict>): Verdict => ({
	decision: 'allow',
	categories: [],
	severity: 0,
	reason: 'Because.',
	...over
});

describe('applyPolicy', () => {
	it('rejects a private blocklist hit with the general reason', () => {
		expect(applyPolicy({ kind: 'blocklist', term: null })).toEqual({
			status: 'rejected',
			source: 'blocklist',
			reason: BLOCKLIST_REASON
		});
	});

	it('names the term of a public blocklist hit, within the reason limit', () => {
		const result = applyPolicy({ kind: 'blocklist', term: 'kill yourself' });
		expect(result.reason).toBe(
			'The comment contains "kill yourself", which the site does not allow.'
		);
		for (const term of BLOCKLIST_TERMS) {
			expect(blocklistReason(term).length).toBeLessThanOrEqual(MODERATION_REASON_MAX);
		}
	});

	it('publishes an allow verdict', () => {
		expect(applyPolicy({ kind: 'verdict', verdict: verdict({}) })).toEqual({
			status: 'published',
			source: 'ai',
			reason: null
		});
	});

	it('holds an allow verdict that carries a severity or a category for a person', () => {
		const held = { status: 'pending', source: 'ai', reason: null };
		expect(applyPolicy({ kind: 'verdict', verdict: verdict({ severity: 1 }) })).toEqual(held);
		expect(
			applyPolicy({ kind: 'verdict', verdict: verdict({ categories: ['harassment'] }) })
		).toEqual(held);
	});

	it('holds a review verdict for a person', () => {
		expect(
			applyPolicy({ kind: 'verdict', verdict: verdict({ decision: 'review', severity: 3 }) })
		).toEqual({ status: 'pending', source: 'ai', reason: null });
	});

	it('holds any failure of the check for a person', () => {
		expect(applyPolicy({ kind: 'failure', code: 'ai-timeout' })).toEqual({
			status: 'pending',
			source: null,
			reason: null
		});
	});

	it('rejects a reject verdict at the severity threshold, with the verdict reason', () => {
		const result = applyPolicy({
			kind: 'verdict',
			verdict: verdict({ decision: 'reject', severity: REJECT_MIN_SEVERITY, reason: 'Slur.' })
		});
		expect(result).toEqual({ status: 'rejected', source: 'ai', reason: 'Slur.' });
	});

	it('holds a reject verdict below the threshold for a person', () => {
		const result = applyPolicy({
			kind: 'verdict',
			verdict: verdict({ decision: 'reject', severity: REJECT_MIN_SEVERITY - 1 })
		});
		expect(result).toEqual({ status: 'pending', source: 'ai', reason: null });
	});
});
