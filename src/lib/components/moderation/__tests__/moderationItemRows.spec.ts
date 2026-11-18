import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationItem } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));

const { default: ModerationItemRow } = await import('../moderationItem.svelte');

const AUTHOR = {
	id: 'u1',
	username: 'anna',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'anna'
};

const MOD = { id: 'mod', role: 'moderator' };

function mount(over: Partial<ModerationItem> = {}, me = MOD, extra: { ranked?: boolean } = {}) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(ModerationItemRow, {
		props: {
			item: {
				comment: {
					id: 'c1',
					parentId: null,
					rootId: null,
					body: 'A comment under review',
					status: 'pending',
					moderationSource: null,
					moderationReason: null,
					moderationRule: null,
					score: 0,
					replyCount: 0,
					createdAt: '2026-11-01T10:00:00.000Z',
					editedAt: null
				},
				author: AUTHOR,
				title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
				aiCategories: [],
				severity: null,
				reports: [],
				authorCommentCount: 4,
				authorMutedUntil: null,
				authorBanned: false,
				authorMutedByModerator: false,
				...over
			},
			me,
			...extra
		},
		target: list
	});
}

afterEach(cleanup);

describe('ModerationItem reports and read-only state', () => {
	it('orders a report as reason, reporter, date, then the note', () => {
		mount({
			reports: [
				{ reason: 'spam', note: 'An advert', createdAt: '2026-11-02T10:00:00.000Z', reporter: 'bo' }
			]
		});
		const line = screen.getByText('Spam').closest('li')!;
		expect(
			[...line.children].map((el) => el.textContent?.trim()).map((t) => t?.replace(/\s+/g, ' '))
		).toEqual(['Spam', 'Reported by bo', expect.stringMatching(/2026|Nov/), 'An advert']);
	});

	it.each([
		['a moderator’s own comment', 'mod', 'moderator' as const],
		['another moderator’s comment', 'm2', 'moderator' as const],
		['an administrator’s comment', 'a1', 'administrator' as const]
	])('shows a line naming who decides, and no controls, on %s', (_label, id, role) => {
		const { container } = mount({ author: { ...AUTHOR, id, role } });
		expect(screen.getByText('An administrator decides on this comment.')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
		expect(container.querySelector('.actions')).toBeNull();
	});

	it('keeps the controls on an ordinary account’s comment', () => {
		const { container } = mount();
		expect(screen.queryByText(/decides on this comment/)).toBeNull();
		expect(container.querySelector('.actions')).not.toBeNull();
	});
});

describe('the severity that ranks a queue row', () => {
	it('shows the classifier’s severity as a toned badge in the author line, from severity 1', () => {
		mount({ severity: 3 });
		expect(screen.getByText('Severity 3')).toBeTruthy();
	});

	it('shows no badge for a comment the classifier found nothing in, or never checked', () => {
		mount({ severity: 0 });
		expect(screen.queryByText(/^Severity/)).toBeNull();
		cleanup();
		mount({ severity: null });
		expect(screen.queryByText(/^Severity/)).toBeNull();
	});

	it('leaves it to the table’s own column when ranked is off', () => {
		mount({ severity: 3 }, MOD, { ranked: false });
		expect(screen.queryByText(/^Severity/)).toBeNull();
	});
});
