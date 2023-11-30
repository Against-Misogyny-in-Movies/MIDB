
import type { Actions } from './$types';

export const actions = {
    finish: async ({cookies, request}) => {
        const data = await request.formData();
        console.log(data)
        return {sucess: true}
    },
    failed: async ({cookies}) => {
        console.log("failed");
    }
} satisfies Actions;