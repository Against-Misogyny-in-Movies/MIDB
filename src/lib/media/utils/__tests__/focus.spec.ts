import { describe, it, expect, afterEach } from 'vitest';
import { focusAfterUpdate } from '../focus.ts';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('focusAfterUpdate', () => {
	it('focuses the element found after the update', async () => {
		document.body.innerHTML = '<p id="target" tabindex="-1"></p>';
		await focusAfterUpdate(() => document.getElementById('target'));
		expect(document.activeElement?.id).toBe('target');
	});

	it('does nothing when there is no target', async () => {
		await expect(focusAfterUpdate(() => null)).resolves.toBeUndefined();
		expect(document.activeElement).toBe(document.body);
	});
});
