import type { PageServerLoad } from "./$types";
import { getMovie } from "./datasource.server";




export const load: PageServerLoad = async ({ params }) => {
  
  


  const [movie] = await Promise.all([getMovie(params.movieId)]);

  return {
    movie
  }
}