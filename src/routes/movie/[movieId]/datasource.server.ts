import { join as joinPath } from "node:path";
import { PUBLIC_TMDB_API_URL } from "$env/static/public";

export interface Movie {
  id: string;
  title: string;
  posterPath: string;
  overview: string;
  releaseDate: string;
  tmdbId: string;

}


export const getMovie = async (movieId: string): Promise<Movie> => {
  const response = await fetch(joinPath(PUBLIC_TMDB_API_URL, "/3/movie/", movieId));
  const data = await response.json();
  return {
    id: data.id,
    title: data.title,
    posterPath: data.poster_path,
    overview: data.overview,
    tmdbId: data.id,
    releaseDate: data.release_date
  }
}