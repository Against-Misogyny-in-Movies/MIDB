import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CommentDate from '../commentDate.svelte';

afterEach(cleanup);

describe('CommentDate', () => {
	it('links the date with the shared link style and the host row’s class', () => {
		render(CommentDate, {
			href: '/movie/1#comment-c',
			createdAt: '2026-11-01T10:00:00.000Z',
			class: 'label'
		});
		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe('/movie/1#comment-c');
		expect(link.classList.contains('link')).toBe(true);
		expect(link.classList.contains('label')).toBe(true);
		expect(link.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-01T10:00:00.000Z');
	});

	it('shows plain text with no address', () => {
		const { container } = render(CommentDate, {
			createdAt: '2026-11-01T10:00:00.000Z',
			class: 'num'
		});
		expect(screen.queryByRole('link')).toBeNull();
		expect(container.querySelector('time.num')).toBeTruthy();
	});
});
