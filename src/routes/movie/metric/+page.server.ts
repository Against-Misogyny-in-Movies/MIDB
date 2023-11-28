import type { PageServerLoad } from "./$types";

export const load: PageServerLoad  = async ({}) => {
    return {
        movie: {
            name: "The Matrix",
            link: "/movie/the-matrix"
        }
    }
}