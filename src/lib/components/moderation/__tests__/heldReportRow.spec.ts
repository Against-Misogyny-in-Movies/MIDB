import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HeldReport } from '#lib/media/types/moderation.ts';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: HeldReportRow } = await import('../heldReportRow.svelte');

afterEach(cleanup);

describe('the held report row', () => {
	const answers = {
		sexualPresent: 'present',
		partnerLevel: null,
		physicalLevel: null,
		stalkingLevel: null,
		objectificationLevel: null,
		framing: null,
		rapeMenDisImp: null,
		sexHarOnScrn: true,
		sexAdultTeen: null,
		childSexAbuse: null,
		incest: null,
		attemptedRape: null,
		rapeOffScrn: null,
		rapeOnScreen: false
	} as const;
	const base: HeldReport = {
		titleId: 't1',
		title: { kind: 'movie', tmdbId: 348, name: 'Alien' },
		account: {
			userId: 'u1',
			username: 'anna',
			createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
			reportCount: 4,
			commentCount: 1,
			role: 'user',
			mutedByModerator: false,
			countsFrom: new Date(Date.now() + 4 * 86_400_000).toISOString(),
			restricted: null
		},
		holdReason: 'busy_new_account',
		createdAt: '2026-11-10T10:00:00.000Z',
		answers: { ...answers },
		um: null
	};
	const UM = {
		rapeMenDisImp: false,
		sexHarOnScrn: false,
		sexAdultTeen: false,
		childSexAbuse: false,
		incest: false,
		attemptedRape: false,
		rapeOffScrn: false,
		rapeOnScreen: true
	};

	it('shows the title, the account, the hold reason and the two actions', () => {
		render(HeldReportRow, { report: base, canAct: true });
		expect(screen.getByRole('link', { name: 'Alien' }).getAttribute('href')).toBe('/movie/348');
		const line = screen.getByRole('link', { name: 'anna' }).closest('p');
		expect(line?.textContent?.replace(/\s+/g, ' ')).toMatch(
			/^anna, 3 days old, 4 community reports not rejected, 1 comment/
		);
		expect(screen.getByRole('link', { name: 'anna' }).getAttribute('href')).toBe(
			'/user/moderation/accounts/u1'
		);
		expect(screen.getByText('Busy new account')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Count it' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
	});

	it('offers no actions for an account the actor cannot act on', () => {
		render(HeldReportRow, { report: base, canAct: false });
		expect(screen.queryByRole('button', { name: 'Count it' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
		expect(screen.getByText('An administrator decides on this report.')).toBeTruthy();
	});

	it('shows UM flags only when the report contradicts the source', () => {
		const { unmount } = render(HeldReportRow, { report: base, canAct: true });
		expect(screen.queryByText('Unconsenting Media')).toBeNull();
		unmount();
		render(HeldReportRow, {
			report: { ...base, holdReason: 'contradicts_source', um: UM },
			canAct: true
		});
		expect(screen.getByText('Contradicts Unconsenting Media')).toBeTruthy();
		expect(screen.getByRole('columnheader', { name: 'Unconsenting Media' })).toBeTruthy();
		expect(screen.getByRole('rowheader', { name: /Rape on screen/ })).toBeTruthy();
	});
});
