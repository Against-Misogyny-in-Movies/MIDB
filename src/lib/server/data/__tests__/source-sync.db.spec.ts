import { beforeEach, describe, expect, it } from 'vitest';
import { sourceSync } from '#db/schema/sources.ts';
import { db } from '#lib/server/db.ts';
import { clearCache } from '#lib/server/cache/index.ts';
import { getSourceSyncDates } from '#lib/server/data/source-sync.ts';

// The query is cached; each test starts from an empty cache.
beforeEach(() => clearCache());

describe('getSourceSyncDates', () => {
	it('is empty on a fresh database', async () => {
		expect(await getSourceSyncDates()).toEqual({});
	});

	it('maps each synced source to an ISO timestamp', async () => {
		await db.insert(sourceSync).values([
			{ source: 'um', lastSuccessAt: new Date('2026-11-12T09:30:00Z'), rowsChanged: 3 },
			{ source: 'bechdel', lastSuccessAt: new Date('2026-11-11T09:31:00Z'), rowsChanged: 0 }
		]);
		expect(await getSourceSyncDates()).toEqual({
			um: '2026-11-12T09:30:00.000Z',
			bechdel: '2026-11-11T09:31:00.000Z'
		});
	});
});
