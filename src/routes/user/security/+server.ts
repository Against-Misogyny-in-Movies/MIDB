import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Sign-in methods are a section of `/user/settings`; the query (an OAuth link's result) goes along. */
export const GET: RequestHandler = ({ url }) => {
	redirect(308, `/user/settings${url.search}`);
};
