import type { RequestHandler } from './$types';
import { PRIVATE_NO_STORE, PUBLIC_TITLE_SOURCES } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import { parseTitleParams } from '#lib/server/titles/title-params.ts';
import { loadTitleSources } from '#lib/server/titles/title-sources.ts';

/**
 * A title's Does the Dog Die and Letterboxd answers, for the title page to fill in after it
 * loads (the page's own HTML carries no streamed data, which the content security policy would
 * block). `PUBLIC_TITLE_SOURCES` when every source answered, `PRIVATE_NO_STORE` when one failed.
 * It never reads the user, sets no cookie, and is limited by IP.
 */
export const GET: RequestHandler = async (event) => {
	const { kind, tmdbId } = parseTitleParams(event.params.kind, event.params.tmdbId);
	await rateLimit(event, 'RL_TITLE_SOURCES');
	const { sources, complete } = await loadTitleSources(kind, tmdbId);
	return Response.json(sources, { headers: complete ? PUBLIC_TITLE_SOURCES : PRIVATE_NO_STORE });
};
