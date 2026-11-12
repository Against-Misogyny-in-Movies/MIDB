import { describe, it, expect, vi } from 'vitest';
import { PUBLIC_PAGE } from '#lib/server/http/cache.ts';

// A plain function, not `vi.fn`: the spy would track the rejected promise and report it as unhandled.
const lookup = vi.hoisted(() => ({
	result: () => Promise.resolve<unknown>(undefined)
}));
vi.mock('#lib/server/titles/load-title.ts', () => ({ loadTitle: () => lookup.result() }));

const movie = await import('../routes/movie/[movieId]/+page.server');
const tv = await import('../routes/tv/[seriesId]/+page.server');

type Load = (event: never) => Promise<unknown>;

const pages: [string, Load, Record<string, string>][] = [
	['movie', movie.load as unknown as Load, { movieId: '603' }],
	['tv', tv.load as unknown as Load, { seriesId: '1399' }]
];

describe.each(pages)('%s page load', (_kind, load, params) => {
	it('sets the public page policy after a successful lookup', async () => {
		lookup.result = () => Promise.resolve({ title: 'x' });
		const setHeaders = vi.fn();
		await expect(load({ params, setHeaders } as never)).resolves.toEqual({ title: 'x' });
		expect(setHeaders).toHaveBeenCalledWith(PUBLIC_PAGE);
	});

	it('sets no cache header when the lookup fails, so an error is not pinned at the edge', async () => {
		lookup.result = () => Promise.reject(new Error('TMDB 429'));
		const setHeaders = vi.fn();
		const outcome = await load({ params, setHeaders } as never).then(
			() => null,
			(err: unknown) => err
		);
		expect(outcome).toEqual(new Error('TMDB 429'));
		expect(setHeaders).not.toHaveBeenCalled();
	});
});
