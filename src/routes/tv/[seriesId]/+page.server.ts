import type { PageServerLoad } from './$types';
import { PUBLIC_PAGE } from '$lib/server/http/cache';
import { getSeries } from './datasource.server';
import { getTitleRow } from '$lib/server/data/title-queries';
import { getUmEntry } from '$lib/server/data/sources';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';
import { getTriggerTagsForSeries } from '$lib/server/integrations/ddd';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Detail data is user-agnostic (the navbar's session comes from /api/me), so a shared
	// CDN may serve it. Nothing in this load may read locals.getUser().
	setHeaders({ 'cache-control': PUBLIC_PAGE });

	const series = await getSeries(params.seriesId);
	const title = await getTitleRow('tv', series);

	const umEntry = title ? await getUmEntry(title.id) : null;
	const umCandidates = umEntry === null ? await getUnconsentingCandidates(series) : [];

	return {
		series,
		umEntry,
		umCandidates,
		triggerTags: getTriggerTagsForSeries(series) // un-awaited: streamed
	};
};
