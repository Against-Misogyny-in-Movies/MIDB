import type { PageServerLoad } from './$types';
import { getSeries } from './datasource.server';
import { getDbMedia, getUnconsenting } from '$lib/server/data/media-queries';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';
import { getTriggerTagsForSeries } from '$lib/server/integrations/ddd';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Detail data is non-personalized, so let the browser/back-forward cache and any CDN
	// serve repeat navigations without re-running this load. s-maxage targets a shared CDN.
	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=3600' });

	const series = await getSeries(params.seriesId);
	const dbMedia = await getDbMedia(series, 'tv');

	const unconsenting = dbMedia ? await getUnconsenting(dbMedia.id) : null;
	const umCandidates = unconsenting === null ? await getUnconsentingCandidates(series) : [];

	return {
		series,
		unconsenting,
		umCandidates,
		triggerTags: getTriggerTagsForSeries(series) // un-awaited: streamed
	};
};
