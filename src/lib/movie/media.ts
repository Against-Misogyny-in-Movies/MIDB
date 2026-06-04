export interface GenderBreakdown {
	unknown: number;
	female: number;
	male: number;
	nonBinary: number;
	total: number;
}

/** Fields common to movies and series — what the shared header/gender components need. */
export interface MediaDetail {
	id: string;
	title: string;
	imdbId: string | null;
	posterPath: string | null;
	overview: string;
	tmdbId: string;
	/** Movie release date OR series first-air date — already a YYYY-... string or ''. */
	releaseDate: string;
	genres: { id: number; name: string }[];
	originCountry: string[];
	originalLanguage: string;
	spokenLanguages: { iso: string; englishName: string }[];
	cast: GenderBreakdown;
	crew: GenderBreakdown;
}
