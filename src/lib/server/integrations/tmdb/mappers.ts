// Pure TMDB response → domain mappers. No fetch, no env: unit-tested against recorded fixtures.
import type {
	CastMember,
	CrewDepartment,
	CrewJob,
	GenderBreakdown,
	GenderCategory,
	MediaDetail
} from '$lib/media/types/media';
import type { Movie } from '$lib/media/types/movie';
import type { Series } from '$lib/media/types/series';
import type { SearchResult } from '$lib/components/search/types';
import { PRIORITY_DEPARTMENTS, type PriorityDepartment } from '$lib/media/utils/departments';

export interface TmdbCreditEntry {
	gender: number;
}

export interface TmdbCastEntry extends TmdbCreditEntry {
	name: string;
	order: number;
}

export interface TmdbCrewEntry extends TmdbCreditEntry {
	name: string;
	job: string;
	department: string;
}

/** Fields `/3/movie/{id}` and `/3/tv/{id}` share (with `append_to_response=credits,external_ids`). */
interface TmdbDetailResponse {
	id: number;
	poster_path?: string | null;
	overview?: string;
	genres?: { id: number; name: string }[];
	origin_country?: string[];
	original_language?: string;
	spoken_languages?: { iso_639_1: string; english_name: string }[];
	external_ids?: { imdb_id?: string | null };
	credits?: { cast?: TmdbCastEntry[]; crew?: TmdbCrewEntry[] };
}

export interface TmdbMovieResponse extends TmdbDetailResponse {
	title: string;
	imdb_id?: string | null;
	release_date?: string;
	tagline?: string;
	runtime?: number;
	budget?: number;
	revenue?: number;
}

export interface TmdbSeriesResponse extends TmdbDetailResponse {
	name?: string;
	first_air_date?: string;
	last_air_date?: string;
	number_of_seasons?: number;
	number_of_episodes?: number;
	episode_run_time?: number[];
	seasons?: { season_number: number; episode_count: number; name: string; air_date?: string }[];
	networks?: { id: number; name: string }[];
	created_by?: { id: number; name: string }[];
}

interface TmdbMultiItem {
	id: number;
	media_type: string;
	title?: string;
	name?: string;
	poster_path?: string | null;
	release_date?: string;
	first_air_date?: string;
}

export interface TmdbSearchResponse {
	results: TmdbMultiItem[];
}

export function aggregateGender(entries: TmdbCreditEntry[]): GenderBreakdown {
	const breakdown: GenderBreakdown = { unknown: 0, female: 0, male: 0, nonBinary: 0, total: 0 };
	for (const entry of entries) {
		breakdown.total++;
		if (entry.gender === 1) breakdown.female++;
		else if (entry.gender === 2) breakdown.male++;
		else if (entry.gender === 3) breakdown.nonBinary++;
		else breakdown.unknown++;
	}
	return breakdown;
}

export function genderCategory(n: number): GenderCategory {
	if (n === 1) return 'female';
	if (n === 2) return 'male';
	if (n === 3) return 'nonBinary';
	return 'unknown';
}

export function buildCastMembers(cast: TmdbCastEntry[]): CastMember[] {
	return cast
		.map((c) => ({ name: c.name, gender: genderCategory(c.gender), order: c.order }))
		.sort((a, b) => a.order - b.order);
}

// Priority departments float to the top of the crew table, in declared order.
export function buildCrewDepartments(crew: TmdbCrewEntry[]): CrewDepartment[] {
	const deptMap = new Map<
		string,
		{ allEntries: TmdbCreditEntry[]; jobMap: Map<string, TmdbCreditEntry[]> }
	>();
	for (const c of crew) {
		let dept = deptMap.get(c.department);
		if (!dept) {
			dept = { allEntries: [], jobMap: new Map() };
			deptMap.set(c.department, dept);
		}
		dept.allEntries.push(c);
		const jobEntries = dept.jobMap.get(c.job) ?? [];
		jobEntries.push(c);
		dept.jobMap.set(c.job, jobEntries);
	}
	return Array.from(deptMap.entries())
		.map(([department, { allEntries, jobMap }]) => {
			const jobs: CrewJob[] = Array.from(jobMap.entries())
				.map(([job, entries]) => ({ job, breakdown: aggregateGender(entries) }))
				.sort((a, b) => b.breakdown.total - a.breakdown.total || a.job.localeCompare(b.job));
			return { department, breakdown: aggregateGender(allEntries), jobs };
		})
		.sort((a, b) => {
			const aPriority = PRIORITY_DEPARTMENTS.indexOf(a.department as PriorityDepartment);
			const bPriority = PRIORITY_DEPARTMENTS.indexOf(b.department as PriorityDepartment);
			// Both priority: sort by declared order
			if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
			// One priority: it goes first
			if (aPriority !== -1) return -1;
			if (bPriority !== -1) return 1;
			// Neither priority: sort by headcount descending
			return b.breakdown.total - a.breakdown.total;
		});
}

/** The `MediaDetail` fields both kinds share; only title, imdb id and date differ by kind. */
export function mapMediaDetail(
	data: TmdbMovieResponse | TmdbSeriesResponse,
	kind: 'movie' | 'tv'
): MediaDetail {
	// `kind` says which half of the intersection is present.
	const d = data as TmdbMovieResponse & TmdbSeriesResponse;
	const isMovie = kind === 'movie';
	const castEntries = d.credits?.cast ?? [];
	const crewEntries = d.credits?.crew ?? [];

	return {
		id: String(d.id),
		title: isMovie ? d.title : (d.name ?? ''),
		imdbId: d.external_ids?.imdb_id ?? (isMovie ? d.imdb_id : null) ?? null,
		posterPath: d.poster_path ?? null,
		overview: d.overview ?? '',
		releaseDate: (isMovie ? d.release_date : d.first_air_date) ?? '',
		tmdbId: String(d.id),
		genres: (d.genres ?? []).map((g) => ({ id: g.id, name: g.name })),
		originCountry: d.origin_country ?? [],
		originalLanguage: d.original_language ?? '',
		spokenLanguages: (d.spoken_languages ?? []).map((l) => ({
			iso: l.iso_639_1,
			englishName: l.english_name
		})),
		cast: aggregateGender(castEntries),
		crew: aggregateGender(crewEntries),
		castMembers: buildCastMembers(castEntries),
		crewDepartments: buildCrewDepartments(crewEntries)
	};
}

export function mapMovie(data: TmdbMovieResponse): Movie {
	return {
		...mapMediaDetail(data, 'movie'),
		tagline: data.tagline ?? '',
		runtime: data.runtime ?? 0,
		budget: data.budget ?? 0,
		revenue: data.revenue ?? 0
	};
}

export function mapSeries(data: TmdbSeriesResponse): Series {
	return {
		...mapMediaDetail(data, 'tv'),
		firstAirDate: data.first_air_date ?? '',
		lastAirDate: data.last_air_date ?? '',
		numberOfSeasons: data.number_of_seasons ?? 0,
		numberOfEpisodes: data.number_of_episodes ?? 0,
		episodeRunTime: data.episode_run_time ?? [],
		seasons: (data.seasons ?? []).map((s) => ({
			seasonNumber: s.season_number,
			episodeCount: s.episode_count,
			name: s.name,
			airDate: s.air_date ?? ''
		})),
		networks: (data.networks ?? []).map((n) => ({ id: n.id, name: n.name })),
		createdBy: (data.created_by ?? []).map((c) => ({ id: c.id, name: c.name }))
	};
}

/** Keeps movie and tv hits only (multi-search also returns people and collections). */
export function mapSearchResults(data: TmdbSearchResponse): SearchResult[] {
	return data.results
		.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
		.map((item) => ({
			id: item.id,
			title: item.title ?? item.name ?? '',
			posterPath: item.poster_path ?? null,
			releaseYear: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
			mediaType: item.media_type as 'movie' | 'tv'
		}));
}
