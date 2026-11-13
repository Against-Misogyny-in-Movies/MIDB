import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerReportView } from '#lib/media/types/reader-reports.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: ReaderReportsSection } = await import('../readerReportsSection.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');

const ME: PublicUser = {
	id: 'me',
	username: 'mary',
	avatarKey: null,
	role: 'user',
	displayName: 'mary'
};

const BASE = '/api/titles/movie/603/reports';

type Handler = (init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function api(routes: Record<string, Handler>) {
	return vi.fn(async (input: string, init?: RequestInit) => {
		const handler = routes[`${init?.method ?? 'GET'} ${input.split('?')[0]}`];
		return handler ? handler(init) : json({ message: 'Not found' }, 404);
	});
}

const flags = Object.fromEntries(
	[
		'rapeMenDisImp',
		'sexHarOnScrn',
		'sexAdultTeen',
		'childSexAbuse',
		'incest',
		'attemptedRape',
		'rapeOffScrn',
		'rapeOnScreen'
	].map((k) => [k, { yes: k === 'incest' ? 2 : 0, no: 1, unsure: 0 }])
);

const COUNTS = {
	total: 7,
	categories: {
		sexual: { present: 5, none: 2 },
		partner: { none: 6, mentioned: 1 },
		physical: { on_screen: 4, mentioned: 1, none: 2 },
		stalking: { none: 7 },
		objectification: { some_scenes: 3, none: 4 }
	},
	flags,
	framing: { condemned: 3, unclear: 0, played_for_laughs: 0, glamorised_or_justified: 0 }
};

function stored(over: Partial<ViewerReportView> = {}): ViewerReportView {
	return {
		sexualPresent: 'none',
		partnerLevel: null,
		physicalLevel: null,
		stalkingLevel: null,
		objectificationLevel: null,
		framing: null,
		status: 'counted',
		holdReason: null,
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		countsFrom: '2026-10-08T00:00:00.000Z',
		...over
	} as unknown as ViewerReportView;
}

const counts =
	(body: unknown = COUNTS): Handler =>
	() =>
		json(body);
const viewer = (report: ViewerReportView | null, mutedUntil: string | null = null): Handler => {
	return () => json({ report, mutedUntil });
};

function mount(fetcher: ReturnType<typeof api>) {
	return render(ReaderReportsSection, { kind: 'movie', tmdbId: '603', fetcher });
}

afterEach(cleanup);

describe('ReaderReportsSection counts', () => {
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
		expect(await screen.findByText('No counted reader reports yet.')).toBeTruthy();
	});

	it('opens the sexual row onto the Unconsenting Media flags', async () => {
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		await screen.findByText('Sexual violence');
		expect(container.querySelectorAll('.flag')).toHaveLength(8);
		expect(container.querySelectorAll('.flag--raised')).toHaveLength(1);
	});
});

describe('ReaderReportsSection signed out', () => {
	beforeEach(() => session.clear());

	it('offers sign-in and no form or flag link', async () => {
		mount(api({ [`GET ${BASE}`]: counts() }));
		await screen.findByText('Physical violence or murder');
		const link = await screen.findByRole('link', { name: 'Sign in to add a report' });
		expect(link.getAttribute('href')).toBe('/auth?next=%2Fmovie%2F603%23reader-reports');
		expect(screen.queryByRole('button', { name: 'Add a report' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
	});
});

describe('ReaderReportsSection signed in', () => {
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
		await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
		await waitFor(() => expect(screen.getByText(/Counts flagged/)).toBeTruthy());
		expect(sent).toEqual({ note: 'One report is off' });
	});
});

describe('ReaderReportsSection reader states', () => {
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
		expect(await screen.findByText('Report saved.')).toBeTruthy();
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

describe('ReaderReportsSection layout', () => {
	beforeEach(() => session.clear());

	it('opens for the #reader-reports hash and carries an id for it', async () => {
		window.location.hash = '#reader-reports';
		const { container } = mount(api({ [`GET ${BASE}`]: counts() }));
		const details = container.querySelector('details')!;
		expect(details.id).toBe('reader-reports');
		await waitFor(() => expect(details.open).toBe(true));
		window.location.hash = '';
	});

	it('gives the framing row its own total', async () => {
		mount(api({ [`GET ${BASE}`]: counts() }));
		expect(await screen.findByText(', of 3 who answered')).toBeTruthy();
	});
});
