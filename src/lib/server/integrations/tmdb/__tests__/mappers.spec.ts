import { describe, expect, test } from 'vitest';

import {
	aggregateGender,
	buildCastMembers,
	buildCrewDepartments,
	mapMediaDetail,
	mapMovie,
	mapSearchResults,
	mapSeries,
	type TmdbMovieResponse,
	type TmdbSearchResponse,
	type TmdbSeriesResponse
} from '$lib/server/integrations/tmdb/mappers';
import movieFixture from '$lib/server/integrations/tmdb/__tests__/fixtures/movie-603.json';
import seriesFixture from '$lib/server/integrations/tmdb/__tests__/fixtures/tv-1399.json';
import searchFixture from '$lib/server/integrations/tmdb/__tests__/fixtures/search-matrix.json';

const movieJson = movieFixture as TmdbMovieResponse;
const seriesJson = seriesFixture as TmdbSeriesResponse;
const searchJson = searchFixture as TmdbSearchResponse;

describe('aggregateGender', () => {
	test('counts mixed genders', () => {
		const result = aggregateGender([
			{ gender: 1 },
			{ gender: 1 },
			{ gender: 2 },
			{ gender: 3 },
			{ gender: 0 }
		]);
		expect(result).toEqual({ female: 2, male: 1, nonBinary: 1, unknown: 1, total: 5 });
	});

	test('returns zeros for empty array', () => {
		const result = aggregateGender([]);
		expect(result).toEqual({ female: 0, male: 0, nonBinary: 0, unknown: 0, total: 0 });
	});

	test('handles missing credits (all unknown)', () => {
		const result = aggregateGender([{ gender: 0 }, { gender: 0 }]);
		expect(result).toEqual({ female: 0, male: 0, nonBinary: 0, unknown: 2, total: 2 });
	});
});

describe('buildCastMembers', () => {
	test('maps gender codes and sorts by order ascending', () => {
		const result = buildCastMembers([
			{ name: 'Charlie', gender: 2, order: 2 },
			{ name: 'Alice', gender: 1, order: 0 },
			{ name: 'Bob', gender: 2, order: 1 },
			{ name: 'Dana', gender: 3, order: 3 },
			{ name: 'Erin', gender: 0, order: 4 }
		]);
		expect(result).toEqual([
			{ name: 'Alice', gender: 'female', order: 0 },
			{ name: 'Bob', gender: 'male', order: 1 },
			{ name: 'Charlie', gender: 'male', order: 2 },
			{ name: 'Dana', gender: 'nonBinary', order: 3 },
			{ name: 'Erin', gender: 'unknown', order: 4 }
		]);
	});

	test('handles order gaps stably', () => {
		const result = buildCastMembers([
			{ name: 'B', gender: 2, order: 10 },
			{ name: 'A', gender: 1, order: 5 }
		]);
		expect(result[0].name).toBe('A');
		expect(result[1].name).toBe('B');
	});

	test('returns empty array for empty input', () => {
		expect(buildCastMembers([])).toEqual([]);
	});
});

describe('buildCrewDepartments', () => {
	test('groups into departments with nested jobs', () => {
		const result = buildCrewDepartments([
			{ name: 'Alice', gender: 1, job: 'Director', department: 'Directing' },
			{ name: 'Bob', gender: 2, job: 'Director', department: 'Directing' },
			{ name: 'Carol', gender: 1, job: 'Producer', department: 'Production' }
		]);
		const directing = result.find((d) => d.department === 'Directing');
		const production = result.find((d) => d.department === 'Production');
		expect(directing).toBeDefined();
		expect(directing!.breakdown).toEqual({
			female: 1,
			male: 1,
			nonBinary: 0,
			unknown: 0,
			total: 2
		});
		expect(directing!.jobs).toHaveLength(1);
		expect(directing!.jobs[0].job).toBe('Director');
		expect(production).toBeDefined();
		expect(production!.breakdown).toEqual({
			female: 1,
			male: 0,
			nonBinary: 0,
			unknown: 0,
			total: 1
		});
	});

	test('priority departments float to the top in declared order, rest sort by headcount', () => {
		const result = buildCrewDepartments([
			{ name: 'A', gender: 2, job: 'Editor', department: 'Editing' },
			{ name: 'B', gender: 2, job: 'Director', department: 'Directing' },
			{ name: 'C', gender: 1, job: 'Director', department: 'Directing' },
			{ name: 'D', gender: 1, job: 'Producer', department: 'Production' },
			{ name: 'E', gender: 2, job: 'Producer', department: 'Production' },
			{ name: 'F', gender: 1, job: 'Executive Producer', department: 'Production' },
			{ name: 'G', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
			{ name: 'H', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
			{ name: 'I', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
			{ name: 'J', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' }
		]);
		// Priority order: Directing (idx 0) < Production (idx 2) < Editing (idx 3)
		// Stunts (4 entries, non-priority) sorts after all priority depts
		expect(result[0].department).toBe('Directing');
		expect(result[1].department).toBe('Production');
		expect(result[2].department).toBe('Editing');
		expect(result[3].department).toBe('Stunts');
	});

	test('sorts jobs within a department by total descending', () => {
		const result = buildCrewDepartments([
			{ name: 'A', gender: 1, job: 'Producer', department: 'Production' },
			{ name: 'B', gender: 2, job: 'Producer', department: 'Production' },
			{ name: 'C', gender: 1, job: 'Executive Producer', department: 'Production' }
		]);
		const prod = result.find((d) => d.department === 'Production')!;
		expect(prod.jobs[0].job).toBe('Producer'); // total=2
		expect(prod.jobs[1].job).toBe('Executive Producer'); // total=1
	});

	test('returns empty array for empty input', () => {
		expect(buildCrewDepartments([])).toEqual([]);
	});

	test('department breakdown aggregates all job entries (person counted once per job)', () => {
		const result = buildCrewDepartments([
			{ name: 'Alice', gender: 1, job: 'Writer', department: 'Writing' },
			{ name: 'Alice', gender: 1, job: 'Story Editor', department: 'Writing' }
		]);
		// Alice has 2 job entries in Writing → dept total = 2
		const writing = result.find((d) => d.department === 'Writing')!;
		expect(writing.breakdown.total).toBe(2);
		expect(writing.breakdown.female).toBe(2);
		expect(writing.jobs).toHaveLength(2);
	});
});

describe('mapMovie (recorded /3/movie/603 fixture)', () => {
	const movie = mapMovie(movieJson);

	test('maps identity, dates and movie-only fields', () => {
		expect(movie).toMatchObject({
			id: '603',
			tmdbId: '603',
			title: 'The Matrix',
			imdbId: 'tt0133093',
			releaseDate: '1999-03-31',
			tagline: 'Believe the unbelievable.',
			runtime: 136,
			budget: 63000000,
			revenue: 463517383,
			originalLanguage: 'en',
			spokenLanguages: [{ iso: 'en', englishName: 'English' }]
		});
	});

	test('aggregates credits and puts priority departments first', () => {
		expect(movie.cast).toEqual({ female: 4, male: 5, nonBinary: 0, unknown: 1, total: 10 });
		expect(movie.castMembers.map((m) => m.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(movie.crewDepartments.slice(0, 5).map((d) => d.department)).toEqual([
			'Directing',
			'Writing',
			'Production',
			'Editing',
			'Camera'
		]);
	});

	test('full mapped shape', () => {
		expect(movie).toMatchSnapshot();
	});

	test('falls back to top-level imdb_id and defaults missing fields', () => {
		const sparse = mapMovie({ id: 1, title: 'Bare', imdb_id: 'tt1' });
		expect(sparse).toMatchObject({
			imdbId: 'tt1',
			posterPath: null,
			overview: '',
			releaseDate: '',
			tagline: '',
			runtime: 0,
			genres: [],
			castMembers: [],
			crewDepartments: []
		});
	});
});

describe('mapSeries (recorded /3/tv/1399 fixture)', () => {
	const series = mapSeries(seriesJson);

	test('maps name and first-air date onto the shared fields', () => {
		expect(series).toMatchObject({
			id: '1399',
			title: 'Game of Thrones',
			imdbId: 'tt0944947',
			releaseDate: '2011-04-17',
			firstAirDate: '2011-04-17',
			lastAirDate: '2019-05-19',
			numberOfSeasons: 8,
			numberOfEpisodes: 73,
			networks: [{ id: 49, name: 'HBO' }]
		});
		expect(series.seasons[1]).toEqual({
			seasonNumber: 1,
			episodeCount: 10,
			name: 'Season 1',
			airDate: '2011-04-17'
		});
	});

	test('full mapped shape', () => {
		expect(series).toMatchSnapshot();
	});

	test('a series never reads a top-level imdb_id', () => {
		const bare = { id: 2, name: 'Show', imdb_id: 'tt9' } as TmdbSeriesResponse;
		expect(mapSeries(bare).imdbId).toBeNull();
	});
});

describe('mapMediaDetail', () => {
	test('movie and series share one mapping of the common fields', () => {
		const { tagline, runtime, budget, revenue, ...movieCommon } = mapMovie(movieJson);
		void [tagline, runtime, budget, revenue];
		expect(mapMediaDetail(movieJson, 'movie')).toEqual(movieCommon);
		expect(Object.keys(mapMediaDetail(seriesJson, 'tv')).sort()).toEqual(
			Object.keys(movieCommon).sort()
		);
	});
});

describe('mapSearchResults (recorded /3/search/multi fixture)', () => {
	test('keeps movie and tv hits only, in TMDB order', () => {
		expect(mapSearchResults(searchJson)).toEqual([
			{
				id: 603,
				title: 'The Matrix',
				posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
				releaseYear: '1999',
				mediaType: 'movie'
			},
			{
				id: 604,
				title: 'The Matrix Reloaded',
				posterPath: '/9TGHDvWrqKBzwDxDodHYXEmOE6J.jpg',
				releaseYear: '2003',
				mediaType: 'movie'
			},
			{
				id: 87299,
				title: 'The Matrix Hackers',
				posterPath: null,
				releaseYear: '',
				mediaType: 'tv'
			},
			{
				id: 624860,
				title: 'The Matrix Resurrections',
				posterPath: null,
				releaseYear: '',
				mediaType: 'movie'
			}
		]);
	});
});
