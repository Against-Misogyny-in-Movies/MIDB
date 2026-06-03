import type { PageServerLoad } from './$types';
import { getMovie } from './datasource.server';

export const load: PageServerLoad = async ({ params }) => {
  const [movie] = await Promise.all([
    getMovie(params.movieId)
    // TODO(sections 3/4): add getMetrics(params.movieId) and getComments(params.movieId) here
    // as un-awaited promises for streaming: { movie, metrics: getMetrics(...), comments: getComments(...) }
  ]);

  return {
    movie
  };
};
