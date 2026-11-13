import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerReportView } from '#lib/media/types/community-reports.ts';
import { BASE, ME, api, counts, json, stored, viewer } from './communityReportsFixtures.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommunityReportsSection } = await import('../communityReportsSection.svelte');
const { CommunityReportsState } = await import('#lib/media/utils/communityReportsState.svelte.js');
const { default: CommunityReportsBadge } = await import('../communityReportsBadge.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');

function mount(fetcher: ReturnType<typeof api>) {
	return render(CommunityReportsSection, {
		kind: 'movie',
		tmdbId: '603',
		reports: new CommunityReportsState('movie', '603', fetcher)
	});
}

afterEach(cleanup);

describe('CommunityReportsSection counts', () => {
	beforeEach(() => session.clear());

	it('reserves a busy slot while loading, then shows the counts', async () => {
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		const slot = container.querySelector('[data-report-counts]')!;
		expect(slot.getAttribute('aria-busy')).toBe('true');
		expect(await screen.findByText('Physical violence or murder')).toBeTruthy();
		expect(slot.getAttribute('aria-busy')).toBe('false');
		expect(container.querySelectorAll('.row').length).toBeGreaterThanOrEqual(6);
	});

	it('gives only the total below the minimum', async () => {
		mount(api({ [`GET ${BASE}`]: counts({ total: 2 }) }));
		expect(
			await screen.findByText('2 counted so far. Counts show once 3 are counted.')
		).toBeTruthy();
		expect(screen.queryByText('Physical violence or murder')).toBeNull();
	});

	it('says so when nobody reported', async () => {
		mount(api({ [`GET ${BASE}`]: counts({ total: 0 }) }));
		expect(await screen.findByText('No counted community reports yet.')).toBeTruthy();
	});

	it('opens the sexual row onto the Unconsenting Media flags', async () => {
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		await screen.findByText('Sexual violence');
		expect(container.querySelectorAll('.flag')).toHaveLength(8);
		expect(container.querySelectorAll('.flag--raised')).toHaveLength(1);
	});
});

describe('CommunityReportsSection signed out', () => {
	beforeEach(() => session.clear());

	it('offers sign-in and no form or flag link', async () => {
		mount(api({ [`GET ${BASE}`]: counts() }));
		await screen.findByText('Physical violence or murder');
		const link = await screen.findByRole('link', { name: 'Sign in to add a report' });
		expect(link.getAttribute('href')).toBe('/auth?next=%2Fmovie%2F603%23community-reports');
		expect(screen.queryByRole('button', { name: 'Add a report' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
	});
});

describe('CommunityReportsSection signed in', () => {
	beforeEach(() => session.set(ME));

	it('shows the status of the reader’s own report and lets it be edited', async () => {
		mount(api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(stored()) }));
		expect(await screen.findByText('This account’s report')).toBeTruthy();
		expect(screen.getByText('Counted')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
	});

	it('names a held report as waiting for review', async () => {
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(stored({ status: 'held', holdReason: 'burst' }))
			})
		);
		expect(await screen.findByText('Waiting for review')).toBeTruthy();
	});

	it('refuses a muted account the form and says until when', async () => {
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(null, '2026-12-01T00:00:00.000Z')
			})
		);
		expect(await screen.findByText(/This account is muted/)).toBeTruthy();
		expect(screen.getByText(/December 1, 2026/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Add a report' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
	});

	it('asks the flags and framing only when they apply', async () => {
		mount(api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(null) }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));

		await fireEvent.click(screen.getByLabelText('I watched this'));

		expect(screen.queryByText('Unconsenting Media concerns')).toBeNull();
		expect(screen.queryByText(/Framing of the violence \(optional\)/)).toBeNull();

		const sexual = screen.getByRole('group', { name: /Sexual violence/ });
		await fireEvent.click(sexual.querySelector('input[value="present"]')!);
		expect(screen.getByText('Unconsenting Media concerns')).toBeTruthy();
		expect(screen.getByText(/Framing of the violence \(optional\)/)).toBeTruthy();

		await fireEvent.click(sexual.querySelector('input[value="none"]')!);
		expect(screen.queryByText('Unconsenting Media concerns')).toBeNull();
		expect(screen.queryByText(/Framing of the violence \(optional\)/)).toBeNull();
	});

	it('saves the answers and reads the report back', async () => {
		let sent: Record<string, unknown> | null = null;
		let saved: ViewerReportView | null = null;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () => json({ report: saved, mutedUntil: null }),
				[`PUT ${BASE}`]: (init) => {
					sent = JSON.parse(init?.body as string);
					saved = stored({ status: 'held' });
					return json({ status: 'held', holdReason: 'burst' });
				}
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		const physical = screen.getByRole('group', { name: /Physical violence or murder/ });
		await fireEvent.click(physical.querySelector('input[value="on_screen"]')!);
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));

		await waitFor(() => expect(screen.getByText('Waiting for review')).toBeTruthy());
		expect(sent).toMatchObject({ watched: true, physicalLevel: 'on_screen', sexualPresent: null });
		expect(screen.getByText(/waits for a moderator/)).toBeTruthy();
	});

	it('deletes the report from the form', async () => {
		const del = vi.fn(() => new Response(null, { status: 204 }));
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(stored()),
				[`DELETE ${BASE}`]: del
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		expect(del).not.toHaveBeenCalled();
		expect(screen.getByText(/It cannot be undone/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Save report' })).toBeNull();
		const confirm = screen.getByRole('button', { name: 'Delete report' });
		await waitFor(() => expect(document.activeElement).toBe(confirm));
		await fireEvent.click(confirm);
		await waitFor(() => expect(screen.getByRole('button', { name: 'Add a report' })).toBeTruthy());
		expect(del).toHaveBeenCalledTimes(1);
	});

	it('sends a "Counts look wrong" flag with its note', async () => {
		let sent: Record<string, unknown> | null = null;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(null),
				[`POST ${BASE}/flag`]: (init) => {
					sent = JSON.parse(init?.body as string);
					return json({ flagged: true });
				}
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Counts look wrong' }));
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'One report is off' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Send to moderators' }));
		await waitFor(() => expect(screen.getByText('Sent to the moderators.')).toBeTruthy());
		expect(sent).toEqual({ note: 'One report is off' });
	});
});

describe('CommunityReportsSection reader states', () => {
	beforeEach(() => session.set(ME));

	it('explains a save without "I watched this" and focuses the checkbox', async () => {
		const put = vi.fn(() => json({ status: 'counted', holdReason: null }));
		mount(
			api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(null), [`PUT ${BASE}`]: put })
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		const box = screen.getByLabelText('I watched this');
		expect(screen.getByText(/Tick “I watched this”/)).toBeTruthy();
		expect(box.getAttribute('aria-describedby')).toBe('report-watched-error');
		await waitFor(() => expect(document.activeElement).toBe(box));
		expect(put).not.toHaveBeenCalled();
		await fireEvent.click(box);
		expect(screen.queryByText(/Tick “I watched this”/)).toBeNull();
	});

	it('keeps the report when Cancel leaves the delete confirmation', async () => {
		mount(api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(stored()) }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.getByRole('button', { name: 'Save report' })).toBeTruthy();
		expect(screen.queryByText(/It cannot be undone/)).toBeNull();
	});

	it('shows a muted reader their report as not counted, without Edit', async () => {
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(stored(), '2026-12-01T00:00:00.000Z')
			})
		);
		expect(await screen.findByText('Not counted: account muted')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(screen.getByText(/This account is muted/)).toBeTruthy();
	});

	it('says when a saved report starts counting', async () => {
		const FUTURE = new Date(Date.now() + 5 * 86_400_000).toISOString();
		let saved: ViewerReportView | null = null;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () => json({ report: saved, mutedUntil: null }),
				[`PUT ${BASE}`]: () => {
					saved = stored({ countsFrom: FUTURE });
					return json({ status: 'counted', holdReason: null });
				}
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		expect(
			await screen.findByText(/It counts from .*, once the account is old enough\./)
		).toBeTruthy();
	});

	it('says a saved report that a moderator rejected does not count', async () => {
		let saved: ViewerReportView | null = null;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () => json({ report: saved, mutedUntil: null }),
				[`PUT ${BASE}`]: () => {
					saved = stored({ status: 'rejected' });
					return json({ status: 'rejected', holdReason: null });
				}
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		expect(
			await screen.findByText('Report saved. A moderator rejected it, so it does not count.')
		).toBeTruthy();
		expect(screen.queryByText(/The counts above include it/)).toBeNull();
	});

	it('offers Try again when the reader’s report cannot be loaded', async () => {
		let attempts = 0;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () =>
					++attempts === 1 ? json({}, 500) : json({ report: null, mutedUntil: null })
			})
		);
		expect(await screen.findByText(/This account’s report could not be loaded/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(await screen.findByRole('button', { name: 'Add a report' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Counts look wrong' })).toBeTruthy();
	});

	it('keeps "Report saved." when the read-back fails', async () => {
		let reads = 0;
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () =>
					++reads === 1 ? json({ report: null, mutedUntil: null }) : json({}, 500),
				[`PUT ${BASE}`]: () => json({ status: 'counted', holdReason: null })
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		expect(
			await screen.findByText('Report saved. The counts above include it once the page reloads.')
		).toBeTruthy();
		expect(screen.getByText(/This account’s report could not be loaded/)).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it.each([
		[400, 'The report was not saved. The server refused the answers.'],
		[401, 'The report was not saved. The session has ended: sign in again.'],
		[403, 'The report was not saved. This account is muted.'],
		[429, 'The report was not saved. Too many requests: wait a moment and try again.']
	])('words a save that answered %i', async (status, sentence) => {
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(null),
				[`PUT ${BASE}`]: () => json({ message: 'refused' }, status)
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		expect(await screen.findByText(sentence)).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Save report' })).toBeTruthy();
	});

	it('words a failed delete and stays on the confirmation', async () => {
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: viewer(stored()),
				[`DELETE ${BASE}`]: () => json({ message: 'down' }, 500)
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		expect(
			await screen.findByText('The report was not deleted. Try again in a moment.')
		).toBeTruthy();
		expect(screen.getByText(/It cannot be undone/)).toBeTruthy();
	});
});

describe('CommunityReportsSection layout', () => {
	beforeEach(() => session.clear());

	it('opens for the #community-reports hash and carries an id for it', async () => {
		window.location.hash = '#community-reports';
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		const details = container.querySelector('details')!;
		expect(details.id).toBe('community-reports');
		await waitFor(() => expect(details.open).toBe(true));
		window.location.hash = '';
	});

	it('opens when the hash changes to #community-reports', async () => {
		window.location.hash = '';
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		const details = container.querySelector('details')!;
		expect(details.open).toBe(false);
		window.location.hash = '#community-reports';
		await waitFor(() => expect(details.open).toBe(true));
		window.location.hash = '';
	});

	it('opens again when the badge is clicked on the hash the page is already on', async () => {
		window.location.hash = '';
		const reports = new CommunityReportsState('movie', '603', api({ [`GET ${BASE}`]: counts() }));
		const { container } = render(CommunityReportsBadge, { reports });
		const section = render(CommunityReportsSection, { kind: 'movie', tmdbId: '603', reports });
		const details = section.container.querySelector('details')!;
		const link = container.querySelector('a')!;
		// A same-hash click fires no `hashchange`, and SvelteKit cancels the browser's own jump.
		link.addEventListener('click', (event) => event.preventDefault());
		expect(details.open).toBe(false);
		await fireEvent.click(link);
		await waitFor(() => expect(details.open).toBe(true));
		details.open = false;
		await fireEvent.click(link);
		await waitFor(() => expect(details.open).toBe(true));
	});

	it('gives the framing row its own total', async () => {
		mount(api({ [`GET ${BASE}`]: counts() }));
		expect(await screen.findByText(', of 3 who answered')).toBeTruthy();
	});
});

describe('CommunityReportsBadge', () => {
	beforeEach(() => session.clear());

	function badge(fetcher: ReturnType<typeof api>) {
		const reports = new CommunityReportsState('movie', '603', fetcher);
		const view = render(CommunityReportsBadge, { reports });
		return { reports, ...view };
	}

	it('keeps its slot busy while loading, then reads the number and links to the section', async () => {
		const { reports, container } = badge(api({ [`GET ${BASE}`]: counts() }));
		const busy = container.querySelector('.badge')!;
		expect(busy.getAttribute('aria-busy')).toBe('true');
		expect(container.querySelector('a')!.getAttribute('href')).toBe('#community-reports');
		await reports.load();
		await waitFor(() => expect(container.textContent).toContain('7 counted community reports'));
		expect(busy.getAttribute('aria-busy')).toBeNull();
	});

	it('keeps the number and the label in one inline wrapper, not as flex items of the badge', async () => {
		const { reports, container } = badge(api({ [`GET ${BASE}`]: counts() }));
		await reports.load();
		await waitFor(() => expect(container.textContent).toContain('7 counted community reports'));
		const badgeEl = container.querySelector('.badge')!;
		// The badge is `inline-flex`, which drops whitespace between its direct children.
		const wrapper = container.querySelector('.num')!.parentElement!;
		expect(wrapper).not.toBe(badgeEl);
		expect(wrapper.parentElement).toBe(badgeEl);
		expect(badgeEl.children).toHaveLength(1);
		expect(wrapper.textContent).toBe('7 counted community reports');
	});

	it('reads the singular for one report', async () => {
		const { reports, container } = badge(api({ [`GET ${BASE}`]: counts({ total: 1 }) }));
		await reports.load();
		await waitFor(() => expect(container.textContent).toContain('1 counted community report'));
		expect(container.textContent).not.toContain('1 counted community reports');
	});

	it('reads "MIDB community reports" with no number on an error', async () => {
		const { reports, container } = badge(api({ [`GET ${BASE}`]: () => json({}, 500) }));
		await reports.load();
		await waitFor(() => expect(container.textContent).toContain('MIDB community reports'));
		expect(container.textContent).not.toMatch(/\d/);
	});

	it('shares one counts request with the section', async () => {
		const fetcher = api({ [`GET ${BASE}`]: counts() });
		const reports = new CommunityReportsState('movie', '603', fetcher);
		render(CommunityReportsBadge, { reports });
		render(CommunityReportsSection, { kind: 'movie', tmdbId: '603', reports });
		await screen.findByText('Physical violence or murder');
		const calls = fetcher.mock.calls.filter(([url]) => url.split('?')[0] === BASE);
		expect(calls).toHaveLength(1);
	});
});
