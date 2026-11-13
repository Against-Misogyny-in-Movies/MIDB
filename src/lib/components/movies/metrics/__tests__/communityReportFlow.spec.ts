import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerReportView } from '#lib/media/types/community-reports.ts';
import {
	BASE,
	ME,
	api,
	counts,
	json,
	stored,
	viewer,
	type Handler
} from './communityReportsFixtures.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { default: CommunityReportsSection } = await import('../communityReportsSection.svelte');
const { CommunityReportsState } = await import('#lib/media/utils/communityReportsState.svelte.js');
const { session } = await import('#lib/media/utils/session.svelte.js');

function mount(fetcher: ReturnType<typeof api>) {
	return render(CommunityReportsSection, {
		kind: 'movie',
		tmdbId: '603',
		reports: new CommunityReportsState('movie', '603', fetcher)
	});
}

afterEach(cleanup);

describe('CommunityReportsSection reporting flow', () => {
	beforeEach(() => session.set(ME));

	const routes = (over: Record<string, Handler> = {}, report: ViewerReportView | null = null) => ({
		[`GET ${BASE}`]: counts(),
		[`GET ${BASE}/viewer`]: viewer(report),
		...over
	});
	const values = (group: HTMLElement) =>
		[...group.querySelectorAll<HTMLInputElement>('input')].map((i) => i.value);

	it('swaps "Add a report" for the report line while a new report is written', async () => {
		mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		const line = screen.getByText('This account’s report');
		expect(screen.queryByRole('button', { name: 'Add a report' })).toBeNull();
		const form = document.querySelector('[data-report-form]')!;
		expect(form.getAttribute('aria-labelledby')).toBe(line.id);
		expect(line.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('keeps the line and its badge while an existing report is edited, without Edit', async () => {
		mount(api(routes({}, stored())));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		const line = screen.getByText('This account’s report');
		expect(screen.getByText('Counted')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
		expect(document.querySelector('[data-report-form]')!.getAttribute('aria-labelledby')).toBe(
			line.id
		);
	});

	it('says a deleted report leaves the counts on reload, until the form opens again', async () => {
		mount(api(routes({ [`DELETE ${BASE}`]: () => new Response(null, { status: 204 }) }, stored())));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		expect(
			await screen.findByText('Report deleted. A reload shows the counts without it.')
		).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add a report' }));
		expect(screen.queryByText(/Report deleted/)).toBeNull();
	});

	it('moves focus to the delete notice so the result is announced', async () => {
		mount(api(routes({ [`DELETE ${BASE}`]: () => new Response(null, { status: 204 }) }, stored())));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		const notice = (await screen.findByText(/Report deleted/)).closest('.deleted')!;
		expect(notice.getAttribute('tabindex')).toBe('-1');
		await waitFor(() => expect(document.activeElement).toBe(notice));
	});

	it('keeps a note typed in the flag plate when the report form opens and closes', async () => {
		mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Counts look wrong' }));
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'One report is off' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add a report' }));
		expect(screen.getByRole('textbox', { name: /What looks wrong/ })).toHaveProperty(
			'value',
			'One report is off'
		);
	});

	it('hides the delete notice once a report is saved', async () => {
		let saved: ViewerReportView | null = stored();
		mount(
			api({
				[`GET ${BASE}`]: counts(),
				[`GET ${BASE}/viewer`]: () => json({ report: saved, mutedUntil: null }),
				[`DELETE ${BASE}`]: () => {
					saved = null;
					return new Response(null, { status: 204 });
				},
				[`PUT ${BASE}`]: () => {
					saved = stored();
					return json({ status: 'counted', holdReason: null });
				}
			})
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));
		await screen.findByText(/Report deleted/);
		await fireEvent.click(screen.getByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		await screen.findByText(/Report saved/);
		expect(screen.queryByText(/Report deleted/)).toBeNull();
	});

	it('puts "I watched this" and its error just above the actions, after the questions', async () => {
		mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
		const box = screen.getByLabelText('I watched this');
		const error = screen.getByText(/Tick “I watched this”/);
		const objectification = screen.getByRole('group', { name: /Sexual objectification/ });
		const save = screen.getByRole('button', { name: 'Save report' });
		const after = (a: Node, b: Node) =>
			a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
		expect(after(objectification, box)).toBeTruthy();
		expect(after(box, error)).toBeTruthy();
		expect(after(error, save)).toBeTruthy();
		expect(box.getAttribute('aria-describedby')).toBe(error.id);
		await waitFor(() => expect(document.activeElement).toBe(box));
	});

	it('hides "Counts look wrong" while the form is open and brings it back after', async () => {
		mount(api(routes()));
		expect(await screen.findByRole('button', { name: 'Counts look wrong' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add a report' }));
		expect(screen.queryByRole('button', { name: 'Counts look wrong' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.getByRole('button', { name: 'Counts look wrong' })).toBeTruthy();
	});

	it('locks the questions and Cancel while a save runs', async () => {
		let release: (r: Response) => void = () => {};
		mount(
			api(
				routes({
					[`PUT ${BASE}`]: () => new Promise<Response>((resolve) => (release = resolve))
				})
			)
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		await fireEvent.click(screen.getByLabelText('I watched this'));
		const radio = screen.getByRole('group', { name: /Sexual violence/ }).querySelector('input')!;
		expect(radio.matches(':disabled')).toBe(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Save report' }));

		const fieldset = document.querySelector('fieldset.questions')!;
		expect(fieldset.hasAttribute('disabled')).toBe(true);
		expect(radio.matches(':disabled')).toBe(true);
		expect(screen.getByRole('button', { name: 'Cancel' }).matches(':disabled')).toBe(true);

		release(json({ status: 'counted', holdReason: null }));
		await waitFor(() => expect(document.querySelector('[data-report-form]')).toBeNull());
	});

	it('lists answers most serious first, with Not sure last', async () => {
		mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		expect(values(screen.getByRole('group', { name: /Sexual violence/ }))).toEqual([
			'present',
			'none',
			'unsure'
		]);
		expect(values(screen.getByRole('group', { name: /Physical violence or murder/ }))).toEqual([
			'on_screen',
			'mentioned',
			'none',
			'unsure'
		]);
		expect(values(screen.getByRole('group', { name: /Sexual objectification/ }))).toEqual([
			'throughout',
			'some_scenes',
			'none',
			'unsure'
		]);
	});

	it('says so when every answer is Not sure, in a line that is always there', async () => {
		const { container } = mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Add a report' }));
		const note = container.querySelector('.unsure')!;
		expect(note.textContent).toBe('Every answer is Not sure.');
		const physical = screen.getByRole('group', { name: /Physical violence or murder/ });
		await fireEvent.click(physical.querySelector('input[value="none"]')!);
		expect(container.querySelector('.unsure')).toBe(note);
		expect(note.textContent).toBe('');
		expect(screen.getByRole('button', { name: 'Save report' }).matches(':disabled')).toBe(false);
	});

	it('names what the flag sends and ties the counter to the field', async () => {
		mount(api(routes()));
		await fireEvent.click(await screen.findByRole('button', { name: 'Counts look wrong' }));
		const intro = screen.getByText('Asks the moderators to review this title’s community reports.');
		expect(
			document.querySelector('form[aria-labelledby="report-flag-title"]')!.contains(intro)
		).toBe(true);
		const field = screen.getByLabelText('What looks wrong (optional)');
		expect(document.getElementById(field.getAttribute('aria-describedby')!)!.textContent).toBe(
			'0 / 500'
		);
	});
});
