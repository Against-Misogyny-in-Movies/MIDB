import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { profileHref } from '#lib/media/utils/profileHref.ts';
import ProfileLink from '../profileLink.svelte';

afterEach(cleanup);

describe('profileHref', () => {
	it('is the profile path of a username, and nothing without one', () => {
		expect(profileHref('anna')).toBe('/u/anna');
		expect(profileHref(null)).toBeUndefined();
		expect(profileHref(undefined)).toBeUndefined();
		expect(profileHref('')).toBeUndefined();
	});
});

describe('ProfileLink', () => {
	it('links the name to the profile with the shared link style', () => {
		render(ProfileLink, { username: 'anna', name: 'anna' });
		const link = screen.getByRole('link', { name: 'anna' });
		expect(link.getAttribute('href')).toBe('/u/anna');
		expect(link.classList.contains('link')).toBe(true);
	});

	it('says the username when no name is given', () => {
		render(ProfileLink, { username: 'bea' });
		expect(screen.getByRole('link', { name: 'bea' }).getAttribute('href')).toBe('/u/bea');
	});

	it('is plain text for an account with no username', () => {
		render(ProfileLink, { username: null, name: 'An account' });
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.getByText('An account')).toBeTruthy();
	});
});
