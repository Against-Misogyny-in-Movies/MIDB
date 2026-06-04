export interface SearchResult {
	id: number;
	title: string;
	posterPath: string | null;
	releaseYear: string;
	mediaType: 'movie' | 'tv';
}
