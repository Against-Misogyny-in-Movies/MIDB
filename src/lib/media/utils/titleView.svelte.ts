import type { Movie } from '$lib/media/types/movie';
import type { Series } from '$lib/media/types/series';
import type { DddResult, TriggerTag } from '$lib/media/types/ddd';
import type { UmEntry } from '$lib/media/types/um';
import { umFlagCount } from './metrics';
import {
	scoreRepresentation,
	scoreSafety,
	type BechdelLike,
	type RepVerdict,
	type SafetyVerdict
} from './verdict';
import { sourceIndex, type SourceIndexItem } from './sourceIndex';
import { createDddState } from './dddStream.svelte.js';
import { EpisodeFilter } from './episodeFilter.svelte.js';

/** What a detail page's load returns (see `loadTitle`), as the client sees it. */
export interface TitleViewData<M extends Movie | Series> {
	media: M;
	bechdel: BechdelLike | null;
	umEntry: UmEntry | null;
	umCandidates?: UmEntry[];
	triggerTags: Promise<DddResult>;
}

type Media<K extends 'movie' | 'tv'> = K extends 'movie' ? Movie : Series;

/**
 * Client page state shared by the movie and TV detail pages, all derived from the load data:
 * the UM entry to show (seeded, auto-picked or user-picked), the streamed DDD result and the
 * two verdicts. Construct it once in the page script (the DDD stream needs component context).
 */
export class TitleView<K extends 'movie' | 'tv'> {
	readonly kind: K;
	readonly isSeries: boolean;
	/** Season/episode selection; TV only. */
	readonly episodes: EpisodeFilter | null;

	media: Media<K>;
	umCandidates: UmEntry[];
	/** The user's pick among several candidates; writable, reset when the title changes. */
	selectedUm: UmEntry | null;
	/** Seeded binding wins, then a lone candidate, then the user's pick. */
	umData: UmEntry | null;
	hasUmCandidates: boolean;
	flagCount: number;
	/** Null while the DDD lookup is still streaming. */
	ddd: DddResult | null;
	/** Tags for the current selection: all tags on movies, the episode filter's on TV. */
	visibleTags: TriggerTag[];
	safety: SafetyVerdict;
	representation: RepVerdict;
	/** The source index under the verdict. */
	sources: SourceIndexItem[];

	constructor(data: () => TitleViewData<Media<K>>, kind: K) {
		this.kind = kind;
		this.isSeries = kind === 'tv';
		const isSeries = this.isSeries;

		this.media = $derived(data().media);
		this.umCandidates = $derived(data().umCandidates ?? []);
		this.selectedUm = $derived.by((): UmEntry | null => {
			void this.media.id; // track
			return null;
		});
		const autoUm = $derived(this.umCandidates.length === 1 ? this.umCandidates[0] : null);
		this.umData = $derived(data().umEntry ?? autoUm ?? this.selectedUm);
		this.hasUmCandidates = $derived(this.umData === null && this.umCandidates.length > 1);
		this.flagCount = $derived(umFlagCount(this.umData));

		const stream = createDddState(() => data().triggerTags, isSeries);
		this.ddd = $derived(stream.current);
		const episodes = isSeries
			? new EpisodeFilter(
					() => this.ddd,
					() => this.media.id
				)
			: null;
		this.episodes = episodes;
		this.visibleTags = $derived(episodes ? episodes.visibleTags : (this.ddd?.tags ?? []));

		this.safety = $derived(
			scoreSafety(
				this.umData,
				episodes && this.ddd ? { ...this.ddd, tags: this.visibleTags } : this.ddd
			)
		);
		this.representation = $derived(
			scoreRepresentation({
				cast: this.media.cast,
				crew: this.media.crew,
				castMembers: this.media.castMembers,
				crewDepartments: this.media.crewDepartments,
				bechdel: isSeries ? null : data().bechdel,
				isSeries
			})
		);
		this.sources = $derived(
			sourceIndex({
				kind,
				bechdelRating: isSeries ? null : (data().bechdel?.rating ?? null),
				umConcerns: this.umData ? this.flagCount : null,
				umCandidateCount: this.hasUmCandidates ? this.umCandidates.length : 0,
				dddTagCount: this.ddd === null ? null : this.visibleTags.length
			})
		);
	}

	selectUm(entry: UmEntry) {
		this.selectedUm = entry;
	}
}
