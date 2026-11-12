import type { RequestHandler } from './$types';
import { PRIVATE_NO_STORE, PUBLIC_IMAGE } from '#lib/server/http/cache.ts';
import { TMDB_IMAGE_FILE, TMDB_IMAGE_SIZES } from '#lib/media/utils/tmdbImage.ts';

const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org/t/p';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** A failed answer: never kept by a browser or the edge, so an outage does not stick. */
function failure(status: number): Response {
	return new Response(null, { status, headers: PRIVATE_NO_STORE });
}

/**
 * A TMDB image, fetched from `image.tmdb.org` and served from MIDB's own origin, so a reader's
 * browser never contacts TMDB. The size and file name are checked against an allow-list before
 * anything is fetched. A success is `PUBLIC_IMAGE`: Workers Caching serves repeats without
 * running the Worker.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { size, file } = params;
	if (!(TMDB_IMAGE_SIZES as readonly string[]).includes(size) || !TMDB_IMAGE_FILE.test(file)) {
		return failure(400);
	}

	let upstream: Response;
	try {
		upstream = await fetch(`${TMDB_IMAGE_ORIGIN}/${size}/${file}`);
	} catch (err) {
		console.warn('TMDB image fetch failed:', err);
		return failure(502);
	}

	// Only the types the file allow-list names: anything else (an HTML error page) is not served.
	const contentType = (upstream.headers.get('content-type') ?? '')
		.split(';')[0]
		.trim()
		.toLowerCase();
	if (!upstream.ok || !IMAGE_TYPES.has(contentType)) {
		return failure(upstream.status === 404 ? 404 : 502);
	}

	return new Response(upstream.body, {
		headers: {
			...PUBLIC_IMAGE,
			'content-type': contentType,
			'x-content-type-options': 'nosniff'
		}
	});
};
