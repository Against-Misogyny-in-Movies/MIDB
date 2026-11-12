import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BECHDEL_RSS_URL, bechdelYearUrl } from '../../../lib/sources/bechdel-html.ts';
import { tmdbExportUrl, type TmdbExportKind } from '../../../lib/sources/tmdb-export.ts';
import { UM_FEED_URL } from '../../../lib/sources/um-feed.ts';
import { fetchSource } from './http.ts';

/** Where the sync reads each source from: the live sites, or the trimmed test fixtures. */
export interface SyncSources {
	/** The Unconsenting Media feed, parsed JSON. */
	umFeed(): Promise<unknown>;
	bechdelRss(): Promise<string>;
	/** One page of a year (page 0 is the first), or null when the site has none (a year without films). */
	bechdelYear(year: number, page: number): Promise<string | null>;
	/** The decompressed TMDB export of that UTC day, or null when it is not published yet. */
	tmdbExport(kind: TmdbExportKind, date: Date): Promise<AsyncIterable<Uint8Array | string> | null>;
}

const PAGE_TIMEOUT_MS = 30_000;
const FEED_TIMEOUT_MS = 180_000;
const EXPORT_TIMEOUT_MS = 600_000;
/** One request a second to bechdeltest.com. */
const BECHDEL_INTERVAL_MS = 1000;

async function requireText(url: string): Promise<string> {
	const res = await fetchSource(url, { timeoutMs: PAGE_TIMEOUT_MS });
	return res!.text();
}

export function liveSources(): SyncSources {
	let lastBechdelRequest = 0;
	const politeBechdel = async () => {
		const wait = lastBechdelRequest + BECHDEL_INTERVAL_MS - Date.now();
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastBechdelRequest = Date.now();
	};
	return {
		async umFeed() {
			const res = await fetchSource(UM_FEED_URL, { timeoutMs: FEED_TIMEOUT_MS });
			return res!.json();
		},
		async bechdelRss() {
			await politeBechdel();
			return requireText(BECHDEL_RSS_URL);
		},
		async bechdelYear(year, page) {
			await politeBechdel();
			const res = await fetchSource(bechdelYearUrl(year, page), {
				timeoutMs: PAGE_TIMEOUT_MS,
				notFoundIsNull: true
			});
			return res ? res.text() : null;
		},
		async tmdbExport(kind, date) {
			const res = await fetchSource(tmdbExportUrl(kind, date), {
				timeoutMs: EXPORT_TIMEOUT_MS,
				notFoundIsNull: true
			});
			if (!res?.body) return null;
			return res.body.pipeThrough(new DecompressionStream('gzip'));
		}
	};
}

const FIXTURES = new URL('../../../test/fixtures/', import.meta.url);
const fixturePath = (name: string) => fileURLToPath(new URL(name, FIXTURES));

async function readFixture(name: string): Promise<string | null> {
	try {
		return await readFile(fixturePath(name), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

/** The trimmed responses in `db/test/fixtures`, for offline runs and tests. */
export function fixtureSources(): SyncSources {
	return {
		async umFeed() {
			return JSON.parse((await readFixture('um-list.json'))!) as unknown;
		},
		async bechdelRss() {
			return (await readFixture('bechdel-rss.xml'))!;
		},
		bechdelYear: (year, page) =>
			readFixture(
				page === 0 ? `bechdel-year-${year}.html` : `bechdel-year-${year}-page-${page}.html`
			),
		async tmdbExport(kind) {
			return createReadStream(fixturePath(`tmdb-${kind}-ids.ndjson`));
		}
	};
}
