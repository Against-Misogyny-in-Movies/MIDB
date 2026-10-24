import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTitles } from '$lib/server/integrations/tmdb';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';

	if (!q.trim()) {
		return json({ results: [] });
	}

	try {
		const results = await searchTitles(q.trim());
		return json({ results });
	} catch (err) {
		console.warn('Search error:', err);
		return json({ results: [] });
	}
};
