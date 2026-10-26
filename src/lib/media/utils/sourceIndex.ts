/** One entry in a title page's source index: a metric, its headline value, and its section. */
export interface SourceIndexItem {
	label: string;
	value: string;
	/** In-page anchor of the metric's section; null when the metric does not apply. */
	href: string | null;
	/** The value is a real reading (not "No data", "Not applicable" or loading). */
	hasData: boolean;
	/** The value is still streaming in. */
	busy: boolean;
}

export interface SourceIndexInput {
	kind: 'movie' | 'tv';
	bechdelRating: number | null;
	/** Concern count of the shown UM entry, or null when no entry is shown. */
	umConcerns: number | null;
	/** UM candidates waiting for the visitor to pick one (0 when an entry is shown). */
	umCandidateCount: number;
	/** Visible DDD tag count, or null while the lookup streams. */
	dddTagCount: number | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The three-item index under a title's verdict: Bechdel, Unconsenting Media, Does the Dog Die. */
export function sourceIndex(input: SourceIndexInput): SourceIndexItem[] {
	const { kind, bechdelRating, umConcerns, umCandidateCount, dddTagCount } = input;

	const bechdel: SourceIndexItem =
		kind === 'tv'
			? { label: 'Bechdel Test', value: 'Not applicable', href: null, hasData: false, busy: false }
			: {
					label: 'Bechdel Test',
					value: bechdelRating === null ? 'No data' : `${bechdelRating}/3`,
					href: '#bechdel',
					hasData: bechdelRating !== null,
					busy: false
				};

	const um: SourceIndexItem = {
		label: 'Unconsenting Media',
		value:
			umConcerns !== null
				? plural(umConcerns, 'concern')
				: umCandidateCount > 1
					? `${umCandidateCount} possible matches`
					: 'No data',
		href: '#unconsenting',
		hasData: umConcerns !== null || umCandidateCount > 1,
		busy: false
	};

	const ddd: SourceIndexItem = {
		label: 'Does the Dog Die',
		value:
			dddTagCount === null ? 'Loading…' : dddTagCount > 0 ? plural(dddTagCount, 'tag') : 'No data',
		href: '#ddd',
		hasData: dddTagCount !== null && dddTagCount > 0,
		busy: dddTagCount === null
	};

	return [bechdel, um, ddd];
}
