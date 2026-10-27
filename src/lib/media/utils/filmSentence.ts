import type { RatedFilm } from '$lib/media/types/catalogue';
import { bechdelTone, safetyTierTone, type BadgeTone } from './tones';

/** One highlighted clause of the landing sentence. */
export interface SentenceClause {
	text: string;
	tone: BadgeTone;
}

/** "<film> <bechdel> and|but <um>." for the landing page, from seeded values only. */
export interface FilmSentence {
	bechdel: SentenceClause;
	/** "but" when one clause reads well and the other does not; "and" otherwise. */
	joiner: 'and' | 'but';
	um: SentenceClause;
}

function umText(concerns: number | null): string {
	if (concerns === null) return 'has no Unconsenting Media entry';
	if (concerns === 0) return 'has no Unconsenting Media concerns';
	return `has ${concerns} Unconsenting Media concern${concerns === 1 ? '' : 's'}`;
}

/** The two clauses for a film, toned like their badges elsewhere on the site. */
export function filmSentence(film: RatedFilm): FilmSentence {
	const bechdel: SentenceClause = {
		text:
			film.bechdelRating === 3
				? 'passes the Bechdel Test'
				: `scores ${film.bechdelRating}/3 on the Bechdel Test`,
		tone: bechdelTone(film.bechdelRating)
	};
	const um: SentenceClause = { text: umText(film.umConcerns), tone: safetyTierTone(film.umTier) };

	const good = (t: BadgeTone) => t === 'pos';
	const bad = (t: BadgeTone) => t === 'mid' || t === 'neg';
	const contrast = (good(bechdel.tone) && bad(um.tone)) || (bad(bechdel.tone) && good(um.tone));

	return { bechdel, joiner: contrast ? 'but' : 'and', um };
}
