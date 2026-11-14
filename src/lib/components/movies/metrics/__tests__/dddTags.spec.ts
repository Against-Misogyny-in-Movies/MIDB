import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TriggerTag } from '#lib/media/types/ddd.ts';
import DddTags from '../dddTags.svelte';

const tag: TriggerTag = {
	topicItemId: 7,
	topicId: 1,
	doesName: 'a dog dies',
	yesSum: 5,
	noSum: 1,
	comment: 'Off screen.',
	category: 'Animals',
	season: null,
	episode: null
};

afterEach(cleanup);

describe('DddTags', () => {
	it('names the comment toggle in text and points it at a comment that exists', async () => {
		const { container } = render(DddTags, { tags: [tag] });
		const button = screen.getByRole('button', { name: 'a dog dies: voter comment' });
		const comment = container.querySelector(`#${button.getAttribute('aria-controls')}`);
		expect(comment).toBeTruthy();
		expect(button.getAttribute('aria-expanded')).toBe('false');
		expect(comment!.hasAttribute('hidden')).toBe(true);
		expect(button.querySelector('i')!.getAttribute('aria-hidden')).toBe('true');

		await fireEvent.click(button);
		expect(button.getAttribute('aria-expanded')).toBe('true');
		expect(comment!.hasAttribute('hidden')).toBe(false);
	});
});
