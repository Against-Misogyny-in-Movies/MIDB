import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StaffMember } from '#lib/media/types/moderation.ts';

const posted = vi.hoisted(() => [] as { action: string; fields: Record<string, string> }[]);

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			posted.push({
				action: node.getAttribute('action') ?? '',
				fields: Object.fromEntries(new FormData(node) as unknown as Iterable<[string, string]>)
			});
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));

const { default: StaffRow } = await import('../staffRow.svelte');
const { default: MakeModeratorForm } = await import('../makeModeratorForm.svelte');
const { default: Page } = await import('../../../../../routes/user/moderation/staff/+page.svelte');

afterEach(() => {
	cleanup();
	posted.length = 0;
});

const member = (id: string, role: 'moderator' | 'administrator'): StaffMember => ({
	user: { id, username: `${id}_name`, avatarKey: null, role, displayName: `${id}_name` },
	since: '2026-10-04T10:00:00.000Z',
	promoted: role === 'moderator'
});

function inList(props: Record<string, unknown>) {
	const list = document.body.appendChild(document.createElement('ul'));
	return render(StaffRow as never, { props, target: list } as never);
}

describe('staffRow', () => {
	it('shows a moderator with their role, since date and a Remove moderator role button that posts their id', async () => {
		inList({ member: member('m1', 'moderator'), meId: 'adm' });
		expect(screen.getByText('Moderator')).toBeTruthy();
		expect(screen.getByText('04/10/2026')).toBeTruthy();
		expect(screen.getByText(/Moderator since/)).toBeTruthy();
		expect(screen.getByRole('link', { name: 'm1_name' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/m1'
		);
		const trigger = screen.getByRole('button', { name: 'Remove moderator role' });
		await fireEvent.click(trigger);
		expect(
			screen.getByText(/Remove the moderator role from m1_name\? The account loses the moderation/)
		).toBeTruthy();
		expect(posted).toEqual([]);
		await fireEvent.click(screen.getAllByRole('button', { name: 'Remove moderator role' })[1]);
		expect(posted).toEqual([{ action: '?/removeModerator', fields: { userId: 'm1' } }]);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByText(/The account loses the moderation/)).toBeNull();
	});

	it('offers nothing for an administrator beyond saying how the role is set', () => {
		inList({ member: member('a1', 'administrator'), meId: 'adm' });
		expect(screen.getByText('Administrator')).toBeTruthy();
		expect(screen.getByText(/Joined/)).toBeTruthy();
		expect(screen.getByText('Set with the seed script.')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});
});

describe('makeModeratorForm', () => {
	it('waits for a username, then posts it to makeModerator', async () => {
		render(MakeModeratorForm);
		const field = screen.getByLabelText(/Make an account a moderator/) as HTMLInputElement;
		const button = screen.getByRole('button', { name: 'Make moderator' }) as HTMLButtonElement;
		expect(field.maxLength).toBe(32);
		expect(button.disabled).toBe(true);
		await fireEvent.input(field, { target: { value: 'varda_7120' } });
		expect(button.disabled).toBe(false);
		await fireEvent.click(button);
		expect(posted).toEqual([{ action: '?/makeModerator', fields: { username: 'varda_7120' } }]);
	});

	it('says what a moderator can do and that only the seed script gives administrator', () => {
		render(MakeModeratorForm);
		expect(screen.getByText(/mutes or bans accounts with the role user/)).toBeTruthy();
		expect(screen.getByText(/only by the seed script/)).toBeTruthy();
		expect(screen.getByText('pnpm db:seed:admin')).toBeTruthy();
	});
});

describe('the staff page', () => {
	it('lists the staff, the form and a way back, and offers no promotion to administrator', () => {
		render(Page, {
			data: {
				me: { id: 'adm', role: 'administrator' },
				staff: [member('adm', 'administrator'), member('m1', 'moderator')]
			},
			form: null
		} as never);
		expect(screen.getByRole('heading', { level: 1, name: 'Staff' })).toBeTruthy();
		const list = screen.getByRole('list', { name: 'Administrators and moderators' });
		expect(list.querySelectorAll(':scope > li')).toHaveLength(2);
		expect(screen.getByRole('link', { name: 'Moderation' }).getAttribute('href')).toBe(
			'/user/moderation'
		);
		expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([
			'Remove moderator role',
			'Make moderator'
		]);
		expect(document.title).toBe('Staff · Moderation · MIDB');
	});
});
