import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { umSource } from '$db/schema/sources';
import { normalizeTitle, stripTrailingYear } from '$db/scripts/lib/normalizeTitle';
import type { UmEntry } from '$lib/media/types/um';
import type { TitleRef } from './title-queries';
import { toUmEntry } from './sources';

/**
 * Resolve UM catalogue entries for a media item whose title has no seeded binding.
 *
 * Year is the disambiguator:
 *  - exact-year match → return it alone (rendered directly, no picker).
 *  - year known but no candidate shares it → return the unknown-year entries, else [].
 *  - year unknown → genuinely ambiguous; return all candidates for the user to pick from.
 *
 * Nothing is persisted; a user's pick lives only for the current page view.
 */
export async function getUnconsentingCandidates(media: TitleRef): Promise<UmEntry[]> {
	const titleKey = stripTrailingYear(normalizeTitle(media.title)).key;

	const altKeys = new Set([titleKey]);
	if (titleKey.endsWith('s')) altKeys.add(titleKey.slice(0, -1));
	else altKeys.add(titleKey + 's');
	const keys = [...altKeys];

	const rows = await db.query.umSource.findMany({
		where:
			keys.length === 1
				? eq(umSource.cleanTitleKey, keys[0])
				: inArray(umSource.cleanTitleKey, keys)
	});
	if (rows.length === 0) return [];

	const mediaYear = media.releaseDate ? parseInt(media.releaseDate.slice(0, 4), 10) : NaN;

	if (!Number.isNaN(mediaYear)) {
		const exact = rows.find((r) => r.year === mediaYear);
		if (exact) return [toUmEntry(exact)];
		const unknownYear = rows.filter((r) => r.year === null);
		if (unknownYear.length > 0) return unknownYear.slice(0, 5).map(toUmEntry);
		return [];
	}

	return rows.slice(0, 5).map(toUmEntry);
}
