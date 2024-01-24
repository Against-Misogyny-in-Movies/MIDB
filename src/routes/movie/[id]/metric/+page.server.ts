import type { PageServerLoad } from "./$types";
import { getAllMetrics } from "./datasource.server";
import { join as joinPath } from "path";

export const load: PageServerLoad  = async ({url}) => {
    const metricData = await getAllMetrics();
    const metrics = metricData.map((m) => ({
        url: joinPath(url.pathname, m.id),
        name: m.name!,
        short: m.shortDescription!,
        description: m.description || undefined
    }))
    
    return {
        metrics,
        movie: {
            name: "The Matrix",
            link: "/movie/the-matrix-2000-yxy"
        }
    }
}