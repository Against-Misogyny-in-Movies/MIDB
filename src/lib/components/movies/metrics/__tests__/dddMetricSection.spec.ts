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
		expect(el.textContent).toContain('No warnings');
	});

	it('says "No data" when DDD has no entry', () => {
		expect(details({ ...result, itemId: null, tags: [] }, []).textContent).toContain('No data');
	});

	it('says "Warnings by episode" when only other episodes have warnings', () => {
		const el = details(
			{ ...result, isSeries: true, tags: [{ ...tag, season: 2, episode: 1 }] },
			[]
		);
		expect(el.textContent).toContain('Warnings by episode');
	});

	it('says "No warnings" for a picked season with none', () => {
		const { container } = render(DddMetricSection, {
			ddd: { ...result, isSeries: true, tags: [{ ...tag, season: 2, episode: 1 }] },
			visibleTags: [],
			seasonPicked: true
		});
		expect(container.querySelector('details')!.textContent).toContain('No warnings');
	});

	it('stays open when the reader opened it while loading and the data arrives empty', async () => {
		const { container, rerender } = render(DddMetricSection, { ddd: null, visibleTags: [] });
		const el = container.querySelector('details')!;
		el.open = true;
		await rerender({ ddd: { ...result, tags: [] }, visibleTags: [] });
		expect(el.open).toBe(true);
	});

	it('stays open when an episode switch empties the visible warnings', async () => {
		const { container, rerender } = render(DddMetricSection, { ddd: result, visibleTags: [tag] });
		const el = container.querySelector('details')!;
		el.open = true;
		await rerender({ ddd: result, visibleTags: [] });
		expect(el.open).toBe(true);
	});

	it('carries the #ddd id on the details and marks it busy while loading', async () => {
		const { container, rerender } = render(DddMetricSection, { ddd: null, visibleTags: [] });
		const el = container.querySelector('details')!;
		expect(el.id).toBe('ddd');
		expect(el.getAttribute('aria-busy')).toBe('true');
		await rerender({ ddd: result, visibleTags: [tag] });
		expect(el.hasAttribute('aria-busy')).toBe(false);
	});

	it('opens for the #ddd hash', async () => {
		window.location.hash = '#ddd';
		const el = details(result, [tag]);
		await Promise.resolve();
		expect(el.open).toBe(true);
		window.location.hash = '';
	});
});
