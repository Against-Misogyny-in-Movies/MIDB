
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getMetricWithOptions } from './datastore.server';

export const load: PageServerLoad = async ({params}) => {
    const {metricId} = params;
    const metricData = await getMetricWithOptions(metricId);

    if(!metricData) {
        throw error(404, 'Metric not found');
    }
    

    return {
        ...metricData,
        description: metricData.description ?? metricData.shortDescription,
        options: metricData.options ?? []
    }
    
}

export const actions = {
    finish: async ({request}) => {
        const data = await request.formData();
        console.log(data)
        return {sucess: true}
    },
    failed: async () => {
        console.log("failed");
    }
} satisfies Actions;