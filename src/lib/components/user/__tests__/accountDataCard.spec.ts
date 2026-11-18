import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { default: AccountDataCard } = await import('../accountDataCard.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn(() => 'blob:export');
const revokeObjectURL = vi.fn();
let clicked: HTMLAnchorElement[] = [];

const file = () =>
	new Response('{"formatVersion":1}', {
		status: 200,
		headers: {
			'content-disposition': 'attachment; filename="midb-data-anna-2026-11-17.json"'
		}
	});
const button = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Download data' });

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	URL.createObjectURL = createObjectURL;
	URL.revokeObjectURL = revokeObjectURL;
	clicked = [];
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		clicked.push(this);
	});
});

afterEach(() => {
	cleanup();
	for (const toast of toasts.items) toasts.dismiss(toast.id);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.resetAllMocks();
});

describe('the account data card', () => {
	it('is a labelled section saying what the file holds, with one button', () => {
		render(AccountDataCard);
		expect(screen.getByRole('heading', { name: 'Account data' })).toBeTruthy();
		expect(screen.getByText(/A JSON file with the account's details and email/)).toBeTruthy();
		expect(screen.getAllByRole('button')).toHaveLength(1);
		expect(button().disabled).toBe(false);
	});

	it('downloads the file under the name the endpoint chose, and says so in a toast', async () => {
		fetchMock.mockResolvedValue(file());
		render(AccountDataCard);
		await fireEvent.click(button());
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(fetchMock).toHaveBeenCalledWith('/api/me/export', { cache: 'no-store' });
		expect(clicked[0].download).toBe('midb-data-anna-2026-11-17.json');
		expect(clicked[0].href).toBe('blob:export');
		// Released later, once the browser has started the download.
		expect(revokeObjectURL).not.toHaveBeenCalled();
		expect(toasts.items[0]).toMatchObject({
			tone: 'success',
			text: 'Downloaded midb-data-anna-2026-11-17.json.'
		});
		expect(button().disabled).toBe(false);
	});

	it('is busy while the request runs', async () => {
		let release: (r: Response) => void = () => {};
		fetchMock.mockReturnValue(new Promise((resolve) => (release = resolve)));
		const { container } = render(AccountDataCard);
		await fireEvent.click(button());
		expect(button().disabled).toBe(true);
		expect(button().getAttribute('aria-busy')).toBe('true');
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
		release(file());
		await waitFor(() => expect(button().disabled).toBe(false));
	});

	it('says the limit was reached on a 429, and downloads nothing', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
		render(AccountDataCard);
		await fireEvent.click(button());
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0]).toMatchObject({
			tone: 'error',
			text: 'Too many downloads. Try again in a minute.'
		});
		expect(clicked).toHaveLength(0);
	});

	it('names what failed on an error or a network failure', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
		render(AccountDataCard);
		await fireEvent.click(button());
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0]).toMatchObject({
			tone: 'error',
			text: 'The data could not be downloaded. Try again.'
		});
		for (const toast of toasts.items) toasts.dismiss(toast.id);
		fetchMock.mockRejectedValueOnce(new TypeError('offline'));
		await fireEvent.click(button());
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0].tone).toBe('error');
		expect(clicked).toHaveLength(0);
		expect(button().disabled).toBe(false);
	});
});
