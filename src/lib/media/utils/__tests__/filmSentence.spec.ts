import { describe, expect, test } from 'vitest';
import { filmSentence } from '$lib/media/utils/filmSentence';
import type { RatedFilm } from '$lib/media/types/catalogue';

const film = (over: Partial<RatedFilm>): RatedFilm => ({
	title: 'X',
	year: 2000,
	tmdbId: 1,
	bechdelRating: 3,
	umConcerns: 0,
	umTier: 'safe',
	...over
});

describe('filmSentence', () => {
	test('both good: "and", green clauses', () => {
		expect(filmSentence(film({}))).toEqual({
			bechdel: { text: 'passes the Bechdel Test', tone: 'pos' },
			joiner: 'and',
			um: { text: 'has no Unconsenting Media concerns', tone: 'pos' }
		});
	});

	test('one good, one not: "but"', () => {
		const s = filmSentence(film({ umConcerns: 1, umTier: 'harmful' }));
		expect(s.joiner).toBe('but');
		expect(s.um).toEqual({ text: 'has 1 Unconsenting Media concern', tone: 'neg' });

		expect(filmSentence(film({ bechdelRating: 1 })).joiner).toBe('but');
	});

	test('both not good: "and"', () => {
		const s = filmSentence(film({ bechdelRating: 2, umConcerns: 4, umTier: 'caution' }));
		expect(s.bechdel).toEqual({ text: 'scores 2/3 on the Bechdel Test', tone: 'mid' });
		expect(s.um).toEqual({ text: 'has 4 Unconsenting Media concerns', tone: 'mid' });
		expect(s.joiner).toBe('and');
	});

	test('no UM entry reads neutral and joins with "and"', () => {
		const s = filmSentence(film({ bechdelRating: 0, umConcerns: null, umTier: null }));
		expect(s.um).toEqual({ text: 'has no Unconsenting Media entry', tone: 'neutral' });
		expect(s.joiner).toBe('and');
	});
});
