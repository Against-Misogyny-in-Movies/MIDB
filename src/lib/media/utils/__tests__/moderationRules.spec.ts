import { describe, expect, it } from 'vitest';
import {
	MODERATION_RULE_LABELS,
	MODERATION_RULE_MEANINGS,
	commentResult,
	hiddenNote,
	moderationRule,
	unpublishedNote
} from '../comments.ts';

describe('the moderation rules', () => {
	it('have a sentence-case label and a meaning each, from one list', () => {
		expect(Object.keys(MODERATION_RULE_LABELS)).toEqual([...moderationRule]);
		expect(Object.keys(MODERATION_RULE_MEANINGS)).toEqual([...moderationRule]);
		for (const rule of moderationRule) {
			expect(MODERATION_RULE_LABELS[rule]).toMatch(/^[A-Z][a-z]/);
			expect(MODERATION_RULE_LABELS[rule]).not.toMatch(/[.:]$/);
			expect(MODERATION_RULE_MEANINGS[rule]).toMatch(/\.$/);
			expect(MODERATION_RULE_MEANINGS[rule]).not.toContain('—');
		}
	});
});

describe('what the author reads', () => {
	it('leads a rejection with the rule, then the note', () => {
		expect(unpublishedNote('rejected', 'Named a reader', 'harassment')).toBe(
			'Rejected: Harassment. Named a reader. Only the author and moderators see the comment.'
		);
		expect(unpublishedNote('rejected', null, 'other')).toBe(
			'Rejected: Other. Only the author and moderators see the comment.'
		);
	});

	it('keeps the automatic check’s reason as it was when there is no rule', () => {
		expect(unpublishedNote('rejected', 'Contains a slur', null)).toBe(
			'Rejected: Contains a slur. Only the author and moderators see the comment.'
		);
		expect(unpublishedNote('rejected', 'Attacks a person.')).toBe(
			'Rejected: Attacks a person. Only the author and moderators see the comment.'
		);
	});

	it('says the rule once for a hidden comment, with the note after it', () => {
		expect(hiddenNote(null, null)).toBe('A moderator hid this comment.');
		expect(hiddenNote('Twice', null)).toBe('A moderator hid this comment. Reason: Twice');
		expect(hiddenNote('Twice', 'spam')).toBe('A moderator hid this comment. Spam. Reason: Twice');
	});

	it('shows the rule in the toast of an edit that a moderator’s rejection still holds', () => {
		expect(
			commentResult('edit', {
				status: 'rejected',
				moderationReason: null,
				moderationRule: 'threat'
			}).text
		).toContain('Rejected: Threat.');
	});
});
