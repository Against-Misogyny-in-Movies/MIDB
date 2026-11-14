import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NavbarMenu from '../navbarMenu.svelte';

afterEach(cleanup);

describe('NavbarMenu', () => {
	it('is a disclosure of plain links, with no ARIA menu roles', async () => {
		const { container } = render(NavbarMenu);
		const trigger = screen.getByRole('button', { name: 'Menu' });
		expect(trigger.hasAttribute('aria-haspopup')).toBe(false);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(container.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
		const methodology = screen.getByRole('link', { name: 'Methodology' });
		expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toContain(methodology);
		expect(document.activeElement).toBe(methodology);
	});
});
