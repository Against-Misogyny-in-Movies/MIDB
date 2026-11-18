import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationTableRow } from '#lib/media/types/moderation.ts';

const posted = vi.hoisted(() => [] as string[]);

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			posted.push(node.getAttribute('action') ?? '');
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: ModerationTable } = await import('../moderationTable.svelte');
const { moderationPrefs } = await import('#lib/media/utils/moderationPrefs.svelte.js');

const ME = { id: 'mod', role: 'moderator' };

const rowOf = (id: string): ModerationTableRow => ({
	comment: {
		id,
		parentId: null,
		rootId: null,
		body: `Body of ${id}`,
		status: 'pending',
		moderationSource: null,
		moderationReason: null,
		moderationRule: null,
		score: 0,
		replyCount: 0,
		createdAt: '2026-11-01T10:00:00.000Z',
		editedAt: null
	},
	author: { id: `u-${id}`, username: id, avatarKey: null, role: 'user', displayName: id },
	title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
	aiCategories: [],
	severity: null,
	severe: false,
	parent: null,
	reports: [],
	authorCommentCount: 1,
	authorMutedUntil: null,
	authorBanned: false,
	authorMutedByModerator: false,
	aiFailure: null,
	latestLabel: null
});

afterEach(() => {
	cleanup();
	posted.length = 0;
	moderationPrefs.shortcuts = true;
});

const mount = () =>
	render(ModerationTable, { rows: [rowOf('c1'), rowOf('c2')], me: ME, selected: [] });
const review = (id: string) => document.getElementById(`review-${id}`) as HTMLElement;
const detail = (id: string) => document.getElementById(`detail-${id}`);
const key = (name: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(document.body, { key: name, ...init });

describe('the table’s keys', () => {
	it('do nothing until a row is open', async () => {
		mount();
		await key('j');
		await key('a');
		expect(detail('c1')).toBeNull();
		expect(posted).toEqual([]);
	});

	it('press the open detail’s buttons: approve at once, hide through its rule list', async () => {
		mount();
		await fireEvent.click(review('c1'));
		await key('a');
		expect(posted).toEqual(['?/approve']);
		await key('h');
		expect(document.querySelector('form.plate')?.getAttribute('action')).toBe('?/hide');
		expect(posted).toEqual(['?/approve']);
	});

	it('open the next and previous row’s detail with j and k, with the focus on its Review button', async () => {
		mount();
		await fireEvent.click(review('c1'));
		await key('j');
		expect(detail('c1')).toBeNull();
		expect(detail('c2')).not.toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(review('c2')));
		await key('j');
		expect(detail('c2')).not.toBeNull();
		await key('k');
		expect(detail('c1')).not.toBeNull();
	});

	it('do nothing when the setting is off', async () => {
		moderationPrefs.setShortcuts(false);
		mount();
		await fireEvent.click(review('c1'));
		await key('a');
		await key('j');
		expect(posted).toEqual([]);
		expect(detail('c1')).not.toBeNull();
		expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
	});

	it('do nothing while a modifier key is held', async () => {
		mount();
		await fireEvent.click(review('c1'));
		await key('a', { ctrlKey: true });
		expect(posted).toEqual([]);
	});
});
