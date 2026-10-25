import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import Avatar from '$lib/components/user/avatars/Avatar.svelte';
import AvatarPicker from '$lib/components/user/avatars/AvatarPicker.svelte';
import { AVATAR_COMPONENTS } from '$lib/components/user/avatars/avatars';
import { AVATAR_DEFS, AVATAR_KEYS } from '$lib/media/utils/avatars';

import '@testing-library/jest-dom';

describe('avatar registry', () => {
	test('every avatar key has exactly one component', () => {
		expect(Object.keys(AVATAR_COMPONENTS).sort()).toEqual([...AVATAR_KEYS].sort());
		expect(AVATAR_KEYS.size).toBe(AVATAR_DEFS.length);
	});
});

describe('Component/Avatar', () => {
	test('renders the icon for a known key, the default otherwise', () => {
		const known = render(Avatar, { avatarKey: 'kahlo' }).container.innerHTML;
		const unknown = render(Avatar, { avatarKey: 'nobody' }).container.innerHTML;
		const none = render(Avatar, { avatarKey: null }).container.innerHTML;
		expect(known).toContain('<svg');
		expect(known).not.toEqual(unknown);
		expect(unknown).toEqual(none);
	});
});

describe('Component/AvatarPicker', () => {
	test('lists every avatar in AVATAR_DEFS order with its icon', () => {
		const { container } = render(AvatarPicker, { value: 'truth' });
		const names = [...container.querySelectorAll('.avatar-name')].map((n) => n.textContent);
		expect(names).toEqual(AVATAR_DEFS.map((a) => a.name));
		expect(container.querySelectorAll('label svg')).toHaveLength(AVATAR_DEFS.length);
		expect(screen.getByDisplayValue('truth')).toBeChecked();
	});

	test('ids stay unique across two pickers and every label points at its own input', () => {
		const first = render(AvatarPicker, { value: 'truth' }).container;
		const second = render(AvatarPicker, { value: null }).container;
		const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		expect(inputs).toHaveLength(AVATAR_DEFS.length * 2);
		expect(new Set(inputs.map((i) => i.id)).size).toBe(inputs.length);

		// Each picker is its own radio group.
		const groupOf = (c: HTMLElement) => c.querySelector('input')!.name;
		expect(groupOf(first)).not.toBe(groupOf(second));

		for (const container of [first, second]) {
			for (const label of container.querySelectorAll('label')) {
				const input = container.querySelector(`#${CSS.escape(label.htmlFor)}`);
				expect(input).toBeInstanceOf(HTMLInputElement);
				expect((input as HTMLInputElement).labels?.[0]).toBe(label);
			}
		}

		// Clicking a label in the second picker checks its input and leaves the first alone.
		const [secondKahlo] = [...second.querySelectorAll('label')].filter((l) =>
			l.htmlFor.endsWith('-kahlo')
		);
		secondKahlo.click();
		expect(second.querySelector<HTMLInputElement>('input[value="kahlo"]')).toBeChecked();
		expect(first.querySelector<HTMLInputElement>('input[value="truth"]')).toBeChecked();
	});
});
