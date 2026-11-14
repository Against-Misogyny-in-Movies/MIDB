/**
 * How far apart a UM year and a title's year may be and still match when no year is equal.
 * UM often dates a film by its festival premiere and TMDB by its release (The Witch: UM 2015,
 * TMDB 2016), so the two can differ by one.
 */
export const UM_YEAR_TOLERANCE = 1;

/** Whether two known years are within `UM_YEAR_TOLERANCE` of each other. */
export function isNearYear(a: number, b: number): boolean {
	return Math.abs(a - b) <= UM_YEAR_TOLERANCE;
}

/** A film `titles` row, as far as matching needs it. */
export interface TitleCandidate {
	id: string;
	year: number | null;
}

/** `cleanTitle` → the films with that key. */
export type CleanTitleIndex = Map<string, TitleCandidate[]>;

export type UmMatch =
	| { kind: 'matched'; titleId: string }
	| { kind: 'ambiguous'; candidateYears: (number | null)[] }
	| { kind: 'no_match' };

export function buildCleanTitleIndex(
	films: readonly { id: string; cleanTitle: string; year: number | null }[]
): CleanTitleIndex {
	const index: CleanTitleIndex = new Map();
	for (const film of films) {
		const candidate = { id: film.id, year: film.year };
		const existing = index.get(film.cleanTitle);
		if (existing) existing.push(candidate);
		else index.set(film.cleanTitle, [candidate]);
	}
	return index;
}

/**
 * Binds a UM film to a `titles` film by title key and year. One film with the key is a match
 * whatever its year; several need the UM year to equal one of theirs, or else to be near
 * (`isNearYear`) exactly one of theirs. The rule is the
 * build-time twin of the runtime picker in `src/lib/server/data/um-candidates.ts`.
 */
export function matchUmFilm(
	index: CleanTitleIndex,
	cleanTitleKey: string,
	year: number | null
): UmMatch {
	const candidates = index.get(cleanTitleKey) ?? [];
	if (candidates.length === 1) return { kind: 'matched', titleId: candidates[0].id };
	if (candidates.length > 1) {
		const byYear = year !== null ? candidates.find((c) => c.year === year) : undefined;
		if (byYear) return { kind: 'matched', titleId: byYear.id };
		const near =
			year !== null ? candidates.filter((c) => c.year !== null && isNearYear(c.year, year)) : [];
		if (near.length === 1) return { kind: 'matched', titleId: near[0].id };
		return { kind: 'ambiguous', candidateYears: candidates.map((c) => c.year) };
	}
	return { kind: 'no_match' };
}
