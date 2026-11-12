import { describe, it, expect } from 'vitest';
import { decideStatus } from '#lib/server/moderation/decide.ts';

describe('decideStatus', () => {
	it('holds every comment for review, with no source, until AI moderation exists', async () => {
		await expect(
			decideStatus({ body: 'A comment', titleName: 'Alien', kind: 'movie' })
		).resolves.toEqual({ status: 'pending', source: null, reason: null, aiVerdict: null });
	});
});
