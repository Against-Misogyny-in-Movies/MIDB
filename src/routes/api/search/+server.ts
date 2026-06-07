import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { search } from './datasource.server';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';

	if (!q.trim()) {
		return json({ results: [] });
	}

	try {
		const results = await search(q.trim());
		return json({ results });
	} catch (err) {
		console.warn('Search error:', err);
		return json({ results: [] });
	}
};
