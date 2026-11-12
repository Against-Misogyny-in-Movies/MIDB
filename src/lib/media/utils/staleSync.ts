import type { SourceSyncDates } from '#lib/media/types/source-sync.ts';

/** Hours without a successful sync after which moderators see a warning. */
export const STALE_SYNC_HOURS = 48;

/**
 * The sources the daily run refreshes, with the names the warning uses. `bechdel_sweep` is not
 * here: the full sweep runs weekly (`docs/architecture.md`, Source sync), so it is always older
 * than a day or two between Sundays.
 */
const DAILY_SOURCES = [
	['bechdel', 'Bechdel Test'],
	['um', 'Unconsenting Media'],
	['popularity', 'TMDB popularity']
] as const;

export type StaleSource = { source: string; label: string; lastSuccessAt: string; hours: number };

/**
 * The daily sources whose last successful sync is older than `STALE_SYNC_HOURS`. A source with
 * no `source_sync` row has never synced here (a fresh database) and is not reported, as on the
 * title pages.
 */
export function staleSyncSources(dates: SourceSyncDates, now = Date.now()): StaleSource[] {
	const stale: StaleSource[] = [];
	for (const [source, label] of DAILY_SOURCES) {
		const at = dates[source];
		if (!at) continue;
		const hours = Math.floor((now - new Date(at).getTime()) / 3_600_000);
		if (hours >= STALE_SYNC_HOURS) stale.push({ source, label, lastSuccessAt: at, hours });
	}
	return stale;
}
