import { afterEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import type { Movie } from '$lib/media/types/movie';
import type { Series } from '$lib/media/types/series';
import type { DddResult, TriggerTag } from '$lib/media/types/ddd';
import type { UmEntry } from '$lib/media/types/um';
import { umFlagCount } from '$lib/media/utils/metrics';
import { scoreRepresentation, scoreSafety } from '$lib/media/utils/verdict';
import { TitleView, type TitleViewData } from '$lib/media/utils/titleView.svelte.js';

const ZERO = { female: 0, male: 0, nonBinary: 0, unknown: 0, total: 0 };

function media<M extends Movie | Series>(id: string, extra: Partial<M> = {}): M {
	return {
		id,
		tmdbId: id,
		title: `Title ${id}`,
		imdbId: null,
		posterPath: null,
		overview: '',
		releaseDate: '',
		genres: [],
		originCountry: [],
		originalLanguage: 'en',
		spokenLanguages: [],
		cast: { ...ZERO, female: 2, male: 2, total: 4 },
		crew: { ...ZERO, male: 3, total: 3 },
		castMembers: [],
		crewDepartments: [],
		...extra
	} as unknown as M;
}

function um(umId: number, flags: Partial<UmEntry> = {}): UmEntry {
	return {
		umId,
		cleanName: `entry ${umId}`,
		year: null,
		comment: null,
		noRape: false,
		rapeMenDisImp: false,
		sexHarOnScrn: false,
		sexAdultTeen: false,
		childSexAbuse: false,
		incest: false,
		attemptedRape: false,
		rapeOffScrn: false,
		rapeOnScreen: false,
		...flags
	};
}

function tag(topicItemId: number, season: number | null, episode: number | null): TriggerTag {
	return {
		topicItemId,
		topicId: topicItemId,
		doesName: `topic ${topicItemId}`,
		yesSum: 3,
		noSum: 0,
		comment: null,
		category: null,
		season,
		episode
	};
}

/** A promise the test settles by hand, standing in for the streamed DDD lookup. */
function deferred() {
	let resolve!: (r: DddResult) => void;
	const promise = new Promise<DddResult>((r) => (resolve = r));
	return { promise, resolve };
}

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
});

/** Builds a TitleView over `$state` page data inside an effect root (the DDD stream needs one). */
function mount<K extends 'movie' | 'tv'>(
	kind: K,
	initial: TitleViewData<K extends 'movie' ? Movie : Series>
) {
	const state = $state({ data: initial });
	let view!: TitleView<K>;
	cleanup = $effect.root(() => {
		view = new TitleView(() => state.data, kind);
	});
	flushSync();
	return { view, state };
}

const pending = () => new Promise<DddResult>(() => {});

describe('TitleView: UM selection', () => {
	test('a seeded umEntry wins over candidates', () => {
		const seeded = um(1, { rapeOnScreen: true });
		const { view } = mount('movie', {
			media: media<Movie>('603'),
			bechdel: null,
			umEntry: seeded,
			umCandidates: [um(2), um(3)],
			triggerTags: pending()
		});
		expect(view.umData).toEqual(seeded);
		expect(view.hasUmCandidates).toBe(false);
	});

	test('a single candidate auto-picks', () => {
		const only = um(4);
		const { view } = mount('movie', {
			media: media<Movie>('603'),
			bechdel: null,
			umEntry: null,
			umCandidates: [only],
			triggerTags: pending()
		});
		expect(view.umData).toEqual(only);
		expect(view.hasUmCandidates).toBe(false);
	});

	test('several candidates show the picker; a pick resets when the title changes', () => {
		const candidates = [um(5), um(6, { incest: true })];
		const { view, state } = mount('movie', {
			media: media<Movie>('1'),
			bechdel: null,
			umEntry: null,
			umCandidates: candidates,
			triggerTags: pending()
		});
		expect(view.umData).toBeNull();
		expect(view.hasUmCandidates).toBe(true);
		expect(view.umCandidates).toHaveLength(2);

		view.selectUm(candidates[1]);
		flushSync();
		expect(view.selectedUm).toEqual(candidates[1]);
		expect(view.umData).toEqual(candidates[1]);
		expect(view.hasUmCandidates).toBe(false);

		state.data = { ...state.data, media: media<Movie>('2') };
		flushSync();
		expect(view.selectedUm).toBeNull();
		expect(view.umData).toBeNull();
		expect(view.hasUmCandidates).toBe(true);
	});

	test('missing umCandidates reads as none', () => {
		const { view } = mount('movie', {
			media: media<Movie>('1'),
			bechdel: null,
			umEntry: null,
			triggerTags: pending()
		});
		expect(view.umCandidates).toEqual([]);
		expect(view.umData).toBeNull();
	});

	test('flagCount matches umFlagCount', () => {
		const entry = um(7, { noRape: true, sexHarOnScrn: true, rapeOffScrn: true });
		const { view } = mount('movie', {
			media: media<Movie>('1'),
			bechdel: null,
			umEntry: entry,
			umCandidates: [],
			triggerTags: pending()
		});
		expect(view.flagCount).toBe(umFlagCount(entry));
		expect(view.flagCount).toBe(2);
	});
});

describe('TitleView: DDD stream and verdicts', () => {
	test('safety is pending while DDD is null, then scores the streamed result', async () => {
		const ddd = deferred();
		const { view } = mount('movie', {
			media: media<Movie>('1'),
			bechdel: null,
			umEntry: um(8),
			umCandidates: [],
			triggerTags: ddd.promise
		});
		expect(view.ddd).toBeNull();
		expect(view.safety.pending).toBe(true);
		expect(view.visibleTags).toEqual([]);

		const result: DddResult = { itemId: 9, tags: [tag(1, null, null)], isSeries: false };
		ddd.resolve(result);
		await ddd.promise;
		await Promise.resolve();
		flushSync();
		expect(view.ddd).toEqual(result);
		expect(view.safety.pending).toBe(false);
		expect(view.safety).toEqual(scoreSafety(um(8), result));
		expect(view.visibleTags).toEqual(result.tags);
	});

	test('a failed DDD lookup settles to an empty result', async () => {
		const { view } = mount('tv', {
			media: media<Series>('1399', { seasons: [] }),
			bechdel: null,
			umEntry: null,
			umCandidates: [],
			triggerTags: Promise.reject(new Error('down'))
		});
		await new Promise((r) => setTimeout(r, 0));
		flushSync();
		expect(view.ddd).toEqual({ itemId: null, tags: [], isSeries: true });
	});

	test('representation scores the movie with its Bechdel rating', () => {
		const m = media<Movie>('1');
		const bechdel = { rating: 3 };
		const { view } = mount('movie', {
			media: m,
			bechdel,
			umEntry: null,
			umCandidates: [],
			triggerTags: pending()
		});
		expect(view.isSeries).toBe(false);
		expect(view.episodes).toBeNull();
		expect(view.representation).toEqual(
			scoreRepresentation({
				cast: m.cast,
				crew: m.crew,
				castMembers: m.castMembers,
				crewDepartments: m.crewDepartments,
				bechdel,
				isSeries: false
			})
		);
	});

	test('series: safety scores the episode-filtered tags and Bechdel is ignored', async () => {
		const ddd = deferred();
		const s = media<Series>('1399', { seasons: [] });
		const { view } = mount('tv', {
			media: s,
			bechdel: { rating: 3 },
			umEntry: null,
			umCandidates: [],
			triggerTags: ddd.promise
		});
		expect(view.representation.signalsTotal).toBe(3);
		expect(view.representation).toEqual(
			scoreRepresentation({
				cast: s.cast,
				crew: s.crew,
				castMembers: [],
				crewDepartments: [],
				bechdel: null,
				isSeries: true
			})
		);

		const result: DddResult = {
			itemId: 1,
			tags: [tag(1, -1, null), tag(2, 1, null), tag(3, null, null)],
			isSeries: true
		};
		ddd.resolve(result);
		await ddd.promise;
		await Promise.resolve();
		flushSync();

		// No season picked: series-level and unscoped tags.
		expect(view.visibleTags.map((t) => t.topicItemId)).toEqual([1, 3]);
		view.episodes!.select(1, null);
		flushSync();
		expect(view.visibleTags.map((t) => t.topicItemId)).toEqual([1, 2]);
		expect(view.safety).toEqual(scoreSafety(null, { ...result, tags: view.visibleTags }));
	});
});
