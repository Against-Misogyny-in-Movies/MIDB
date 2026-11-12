import { describe, expect, it } from 'vitest';
import { STALE_SYNC_HOURS, staleSyncSources } from '#lib/media/utils/staleSync.ts';

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe('staleSyncSources', () => {
	it('reports a daily source at or past the limit, and only that', () => {
		const stale = staleSyncSources(
			{ bechdel: ago(STALE_SYNC_HOURS - 1), um: ago(STALE_SYNC_HOURS), popularity: ago(100) },
			NOW
		);
		expect(stale.map((s) => [s.source, s.hours])).toEqual([
			['um', STALE_SYNC_HOURS],
			['popularity', 100]
		]);
		expect(stale[0].label).toBe('Unconsenting Media');
	});

	it('ignores the weekly Bechdel sweep', () => {
		expect(staleSyncSources({ bechdel_sweep: ago(24 * 6) }, NOW)).toEqual([]);
	});

	it('reports nothing for a database that never synced', () => {
		expect(staleSyncSources({}, NOW)).toEqual([]);
	});
});
