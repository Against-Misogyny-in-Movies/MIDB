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
		expect(await screen.findByText(/2 reports so far/)).toBeTruthy();
		expect(screen.queryByText('Physical violence or murder')).toBeNull();
	});

	it('says so when nobody reported', async () => {
		mount(api({ [`GET ${BASE}`]: counts({ total: 0 }) }));
		expect(await screen.findByText('No reader reports yet.')).toBeTruthy();
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
		expect(link.getAttribute('href')).toBe('/auth?next=%2Fmovie%2F603');
		expect(screen.queryByRole('button', { name: 'Add a report' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
	});
});

describe('ReaderReportsSection signed in', () => {
	beforeEach(() => session.set(ME));

	it('shows the status of the reader’s own report and lets it be edited', async () => {
		mount(api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(stored()) }));
		expect(await screen.findByText('Your report')).toBeTruthy();
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

	it('keeps Save disabled until "I watched this", asks the flags and framing only when they apply', async () => {
		mount(api({ [`GET ${BASE}`]: counts(), [`GET ${BASE}/viewer`]: viewer(null) }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));

		const save = screen.getByRole('button', { name: 'Save report' }) as HTMLButtonElement;
		expect(save.disabled).toBe(true);
		await fireEvent.click(screen.getByLabelText('I watched this'));
		expect(save.disabled).toBe(false);

		expect(screen.queryByText('Unconsenting Media concerns')).toBeNull();
		expect(screen.queryByText(/How the title treats the violence/)).toBeNull();

		const sexual = screen.getByRole('group', { name: /Sexual violence/ });
		await fireEvent.click(sexual.querySelector('input[value="present"]')!);
		expect(screen.getByText('Unconsenting Media concerns')).toBeTruthy();
		expect(screen.getByText(/How the title treats the violence/)).toBeTruthy();

		await fireEvent.click(sexual.querySelector('input[value="none"]')!);
		expect(screen.queryByText('Unconsenting Media concerns')).toBeNull();
		expect(screen.queryByText(/How the title treats the violence/)).toBeNull();
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
		await waitFor(() => expect(screen.getByRole('button', { name: 'Add a report' })).toBeTruthy());
		expect(del).toHaveBeenCalled();
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
