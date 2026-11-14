import type { TitleSources } from '#lib/media/types/title-sources.ts';

/** Fetches a title's live sources; rejects on a network error or a non-OK answer. */
async function fetchTitleSources(kind: string, tmdbId: string): Promise<TitleSources> {
	const res = await fetch(`/api/titles/${kind}/${tmdbId}/sources`);
	if (!res.ok) throw new Error(`sources ${res.status}`);
	return (await res.json()) as TitleSources;
}

/**
 * A getter for the title's sources request, shared by every stream that reads it: one request
 * per title, started by the first getter call and reused until the title changes. Call it from
 * an effect, never from render, so the request starts after mount and first paint never waits
 * for it.
 */
export function createTitleSourcesRequest(
	ref: () => { kind: string; tmdbId: string }
): () => Promise<TitleSources> {
	let last: { key: string; promise: Promise<TitleSources> } | null = null;
	return () => {
		const { kind, tmdbId } = ref();
		const key = `${kind}:${tmdbId}`;
		if (last?.key !== key) last = { key, promise: fetchTitleSources(kind, tmdbId) };
		return last.promise;
	};
}
