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
 * whatever its year; several need the UM year to equal one of theirs. The rule is the
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
		return { kind: 'ambiguous', candidateYears: candidates.map((c) => c.year) };
	}
	return { kind: 'no_match' };
}
