import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { DddResult, TriggerTag } from '#lib/media/types/ddd.ts';
import DddMetricSection from '../dddMetricSection.svelte';

const tag: TriggerTag = {
	topicItemId: 1,
	topicId: 1,
	doesName: 'a dog dies',
	yesSum: 5,
	noSum: 1,
	comment: null,
	category: 'Animals',
	season: null,
	episode: null
};
const result: DddResult = { itemId: 1, tags: [tag], isSeries: false };

afterEach(cleanup);

function details(ddd: DddResult | null, visibleTags: TriggerTag[]) {
	const { container } = render(DddMetricSection, { ddd, visibleTags });
	return container.querySelector('details')!;
}

describe('DddMetricSection', () => {
	it('starts closed while loading, with the skeleton inside', () => {
		const el = details(null, []);
		expect(el.open).toBe(false);
		expect(el.textContent).toContain('Loading…');
		expect(el.querySelector('.skeleton')).toBeTruthy();
	});

	it('starts closed with warnings', () => {
		const el = details(result, [tag]);
		expect(el.open).toBe(false);
		expect(el.textContent).toContain('1 warning');
	});

	it('starts closed with no warnings', () => {
		const el = details({ ...result, tags: [] }, []);
		expect(el.open).toBe(false);
		expect(el.textContent).toContain('No data');
	});

	it('keeps the reader’s toggle when the data arrives', async () => {
		const { container, rerender } = render(DddMetricSection, { ddd: null, visibleTags: [] });
		const el = container.querySelector('details')!;
		el.open = true;
		await rerender({ ddd: result, visibleTags: [tag] });
		expect(el.open).toBe(true);
	});
});
