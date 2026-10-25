import { render } from '@testing-library/svelte';
import CheckboxTile from '$lib/components/ui/form/checkboxTile.svelte';
import { describe, expect, test } from 'vitest';

import '@testing-library/jest-dom';

describe('Component/CheckboxTile', () => {
	test('two tiles get distinct ids; clicking a label toggles only its own checkbox', () => {
		render(CheckboxTile, { name: 'genre', title: 'Drama' });
		render(CheckboxTile, { name: 'genre', title: 'Comedy' });
		const [first, second] = [...document.querySelectorAll('input')];
		const labels = [...document.querySelectorAll('label')];
		expect(first.id).not.toBe(second.id);
		expect(labels.map((l) => l.htmlFor)).toEqual([first.id, second.id]);

		labels[1].click();
		expect(second).toBeChecked();
		expect(first).not.toBeChecked();
	});
});
