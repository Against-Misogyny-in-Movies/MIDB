import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecentAction } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: RecentActionRow } = await import('../recentActionRow.svelte');

afterEach(cleanup);

const PERSON = {
	id: 'ada',
	username: 'ada_1234',
	avatarKey: null,
	role: 'moderator' as const,
	displayName: 'ada_1234'
};
const ROW: RecentAction = {
	id: 'a1',
	action: 'unmute',
	reason: null,
	rule: null,
	createdAt: '2026-11-18T10:00:00.000Z',
	actor: { ...PERSON, id: 'adm', username: 'adm_one', displayName: 'adm_one' },
	targetUser: {
		...PERSON,
		id: 'w',
		username: 'woolf_2210',
		displayName: 'woolf_2210',
		role: 'user'
	},
	muteHours: null,
	commentBody: null,
	commentId: null,
	commentStatus: null,
	commentEditedAt: null,
	inForce: null,
	flag: null,
	reverses: null,
	title: null
};

function mount(over: Partial<RecentAction>) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(
		RecentActionRow as never,
		{
			props: { entry: { ...ROW, ...over }, me: { id: 'adm', role: 'administrator' } },
			target: list
		} as never
	);
}

describe('a reversal row', () => {
	it('says which action it undid, by whom and when', () => {
		mount({
			reverses: { action: 'mute', actor: 'ada_1234', createdAt: '2026-11-17T10:00:00.000Z' }
		});
		expect(screen.getByText(/Undoes the mute by ada_1234\s+on 17\/11\/2026\./)).toBeTruthy();
	});

	it('names a removed actor, and calls a reject a rejection', () => {
		mount({
			action: 'restore',
			reverses: { action: 'reject', actor: null, createdAt: '2026-11-17T10:00:00.000Z' }
		});
		expect(screen.getByText(/Undoes the rejection by a removed account/)).toBeTruthy();
	});

	it('says nothing when the data does not say', () => {
		mount({});
		expect(screen.queryByText(/Undoes/)).toBeNull();
	});
});
