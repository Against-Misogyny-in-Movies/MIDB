/** TMDB's daily id exports, newline-delimited JSON, ready by 08:00 UTC. */

export type TmdbExportKind = 'movie' | 'tv';

const EXPORT_NAMES: Record<TmdbExportKind, string> = { movie: 'movie_ids', tv: 'tv_series_ids' };

/** The gzipped export of `kind` for the UTC day of `date`. */
export function tmdbExportUrl(kind: TmdbExportKind, date: Date): string {
	const [year, month, day] = date.toISOString().slice(0, 10).split('-');
	return `https://files.tmdb.org/p/exports/${EXPORT_NAMES[kind]}_${month}_${day}_${year}.json.gz`;
}

export interface TmdbPopularity {
	id: number;
	popularity: number;
}

/**
 * Reads the decompressed export as it streams in and yields each line's `id` and `popularity`.
 * Lines are not held, so the file's size does not matter. A line that is not JSON with both
 * fields throws.
 */
export async function* readTmdbExport(
	chunks: AsyncIterable<Uint8Array | string>
): AsyncGenerator<TmdbPopularity> {
	const decoder = new TextDecoder();
	let pending = '';
	const parse = (line: string): TmdbPopularity | null => {
		if (!line.trim()) return null;
		let value: unknown;
		try {
			value = JSON.parse(line);
		} catch {
			throw new Error('The TMDB export has a line that is not JSON.');
		}
		const { id, popularity } = (value ?? {}) as { id?: unknown; popularity?: unknown };
		if (typeof id !== 'number' || typeof popularity !== 'number') {
			throw new Error('The TMDB export has a line without an id and a popularity.');
		}
		return { id, popularity };
	};
	for await (const chunk of chunks) {
		pending += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
		const lines = pending.split('\n');
		pending = lines.pop() ?? '';
		for (const line of lines) {
			const row = parse(line);
			if (row) yield row;
		}
	}
	pending += decoder.decode();
	const last = parse(pending);
	if (last) yield last;
}
