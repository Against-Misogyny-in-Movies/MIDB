import { describe, it, expect, vi } from 'vitest';
vi.mock('$app/env/public', () => ({ PUBLIC_TMDB_IMAGE_URL: '/img/tmdb' }));

import { TMDB_IMAGE_FILE, TMDB_IMAGE_SIZES, tmdbImageUrl } from '#lib/media/utils/tmdbImage.ts';

describe('tmdbImageUrl', () => {
	it('defaults the base to PUBLIC_TMDB_IMAGE_URL', () => {
		expect(tmdbImageUrl('w300', '/abc.jpg')).toBe('/img/tmdb/w300/abc.jpg');
	});

	it('joins base, size and file, with or without the slashes TMDB paths carry', () => {
		expect(tmdbImageUrl('w500', '/abc.jpg', '/img/tmdb')).toBe('/img/tmdb/w500/abc.jpg');
		expect(tmdbImageUrl('w92', 'abc.jpg', '/img/tmdb/')).toBe('/img/tmdb/w92/abc.jpg');
		expect(tmdbImageUrl('w780', '/abc.jpg', 'https://image.tmdb.org/t/p')).toBe(
			'https://image.tmdb.org/t/p/w780/abc.jpg'
		);
	});

	it('never offers original', () => {
		expect(TMDB_IMAGE_SIZES).not.toContain('original');
		expect(Math.max(...TMDB_IMAGE_SIZES.map((s) => Number(s.slice(1))))).toBe(780);
	});
});

describe('TMDB_IMAGE_FILE', () => {
	it.each(['uoTPjx07dxTrC1g3dYeaS2WNVGL.jpg', 'a_b-c.png', 'x.webp'])('accepts %s', (f) => {
		expect(TMDB_IMAGE_FILE.test(f)).toBe(true);
	});
	it.each(['', '.jpg', 'a.gif', 'a/b.jpg', '../a.jpg', 'a.jpg\n', 'a b.jpg', 'a.jpg.jpg'])(
		'rejects %j',
		(f) => {
			expect(TMDB_IMAGE_FILE.test(f)).toBe(false);
		}
	);
});
