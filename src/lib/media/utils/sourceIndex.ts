import type { LetterboxdOutcome } from '#lib/media/types/letterboxd.ts';
import type { DddResult } from '#lib/media/types/ddd.ts';
import { dddStatus } from '#lib/media/utils/dddStatus.ts';

/** One entry in a title page's source index: a metric, its headline value, and its section. */
export interface SourceIndexItem {
	source: 'bechdel' | 'um' | 'ddd' | 'letterboxd';
	label: string;
	value: string;
	/** In-page anchor of the metric's section; null when the metric does not apply. */
	href: string | null;
	/** The value is a real reading (not "No data", "Not applicable" or loading). */
	hasData: boolean;
	/** The value is still streaming in. */
	busy: boolean;
	/** The link leaves the site. */
	external?: boolean;
	/** The link's accessible name, when the visible text is not the whole reading. */
	ariaLabel?: string;
}

export interface SourceIndexInput {
	kind: 'movie' | 'tv';
	bechdelRating: number | null;
	/** Concern count of the shown UM entry, or null when no entry is shown. */
	umConcerns: number | null;
	/** UM candidates waiting for the visitor to pick one (0 when an entry is shown). */
	umCandidateCount: number;
	/** The DDD result, or null while the lookup streams. */
	ddd: DddResult | null;
	/** Warnings the current episode selection shows. */
	dddVisibleCount: number;
	/** A season (or episode) is picked on the series page. */
	dddSeasonPicked?: boolean;
	/** A film page with the Letterboxd keys set; `result` is undefined while it streams. */
	letterboxd?: { result: LetterboxdOutcome | undefined };
}

const plural = (n: number, word: string, format: (n: number) => string = String) =>
	`${format(n)} ${word}${n === 1 ? '' : 's'}`;

/** The index under a title's verdict: Bechdel, Unconsenting Media, Does the Dog Die, and on a film with the keys set, Letterboxd. */
export function sourceIndex(input: SourceIndexInput): SourceIndexItem[] {
	const {
		kind,
		bechdelRating,
		umConcerns,
		umCandidateCount,
		ddd,
		dddVisibleCount,
		dddSeasonPicked,
		letterboxd
	} = input;

	const bechdel: SourceIndexItem =
		kind === 'tv'
			? {
					source: 'bechdel',
					label: 'Bechdel Test',
					value: 'Not applicable',
					href: null,
					hasData: false,
					busy: false
				}
			: {
					source: 'bechdel',
					label: 'Bechdel Test',
					value: bechdelRating === null ? 'No data' : `${bechdelRating}/3`,
					href: '#bechdel',
					hasData: bechdelRating !== null,
					busy: false
				};

	const um: SourceIndexItem = {
		source: 'um',
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

	const dddState = dddStatus(ddd, dddVisibleCount, dddSeasonPicked);
	const dddItem: SourceIndexItem = {
		source: 'ddd',
		label: 'Does the Dog Die',
		value: dddState.label,
		href: '#ddd',
		hasData: dddState.hasData,
		busy: dddState.busy
	};

	if (kind === 'tv' || !letterboxd) return [bechdel, um, dddItem];
	return [bechdel, um, dddItem, letterboxdItem(letterboxd.result)];
}

const countFormat = new Intl.NumberFormat('en-US');

function letterboxdItem(result: LetterboxdOutcome | undefined): SourceIndexItem {
	const base = { source: 'letterboxd', label: 'Letterboxd' } as const;
	if (result === undefined) {
		return { ...base, value: 'Loading…', href: null, hasData: false, busy: true };
	}
	if (result === 'failed') {
		return { ...base, value: 'Not available', href: null, hasData: false, busy: false };
	}
	if (result === null) {
		return { ...base, value: 'No data', href: null, hasData: false, busy: false };
	}
	const rating = result.rating.toFixed(1);
	const from =
		result.ratingCount === null
			? ''
			: ` from ${plural(result.ratingCount, 'rating', countFormat.format)}`;
	return {
		...base,
		value: `${rating}/5`,
		href: result.url,
		hasData: true,
		busy: false,
		external: true,
		ariaLabel: `Letterboxd: ${rating} out of 5${from}, opens Letterboxd in a new tab`
	};
}
