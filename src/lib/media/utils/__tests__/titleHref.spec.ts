import { describe, expect, it } from 'vitest';
import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';

describe('titleHref', () => {
	it('routes a title by kind and TMDB id, and has no route without an id', () => {
		expect(titleHref('movie', 348)).toBe('/movie/348');
		expect(titleHref('tv', 1396)).toBe('/tv/1396');
		expect(titleHref('movie', null)).toBeUndefined();
	});
});

describe('commentHref', () => {
	it('points at the comment on its title page', () => {
		expect(commentHref('movie', 348, 'abc-123')).toBe('/movie/348#comment-abc-123');
		expect(commentHref('tv', 1396, 'c9')).toBe('/tv/1396#comment-c9');
	});

	it('is undefined when the title has no TMDB id', () => {
		expect(commentHref('movie', null, 'abc')).toBeUndefined();
	});
});
