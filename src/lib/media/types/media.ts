export interface GenderBreakdown {
	unknown: number;
	female: number;
	male: number;
	nonBinary: number;
	total: number;
}

export type GenderCategory = 'female' | 'male' | 'nonBinary' | 'unknown';

export interface CastMember {
	name: string;
	gender: GenderCategory;
	order: number;
}

export interface CrewJob {
	job: string;
	breakdown: GenderBreakdown;
}

export interface CrewDepartment {
	department: string;
	breakdown: GenderBreakdown;
	jobs: CrewJob[];
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
	castMembers: CastMember[];
	crewDepartments: CrewDepartment[];
}
