import type { PageServerLoad } from './$types';
import { getSeries } from './datasource.server';
import {
	getOrCreateDbMedia,
	getUnconsenting,
	getUnconsentingCandidates
} from '../../movie/[movieId]/db.server';
import { getTriggerTagsForSeries } from '../../movie/[movieId]/ddd.server';

export const load: PageServerLoad = async ({ params }) => {
	const series = await getSeries(params.seriesId);
	const dbMedia = await getOrCreateDbMedia(series, 'tv');

	const unconsenting = await getUnconsenting(dbMedia.id);
	const umCandidates = unconsenting === null ? await getUnconsentingCandidates(series) : [];

	return {
		series,
		unconsenting,
		umCandidates,
		triggerTags: getTriggerTagsForSeries(series) // un-awaited: streamed
	};
};
