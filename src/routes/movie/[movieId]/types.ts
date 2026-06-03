export interface GenderBreakdown {
  unknown: number;
  female: number;
  male: number;
  nonBinary: number;
  total: number;
}

export interface Movie {
  id: string;
  title: string;
  imdbId: string | null;
  posterPath: string | null;
  overview: string;
  releaseDate: string;
  tmdbId: string;
  tagline: string;
  runtime: number;
  budget: number;
  revenue: number;
  genres: { id: number; name: string }[];
  originCountry: string[];
  originalLanguage: string;
  spokenLanguages: { iso: string; englishName: string }[];
  cast: GenderBreakdown;
  crew: GenderBreakdown;
}
