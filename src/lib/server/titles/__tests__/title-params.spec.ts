import { describe, expect, it } from 'vitest';
import { communityReportsTag } from '#lib/server/http/cache.ts';
import { parseTitleParams } from '#lib/server/titles/title-params.ts';

describe('parseTitleParams', () => {
	it('normalises a padded id so a cache tag and its purge name the same title', () => {
		const padded = parseTitleParams('movie', '0348');
		const plain = parseTitleParams('movie', '348');
		expect(padded).toEqual({ kind: 'movie', tmdbId: '348' });
		expect(communityReportsTag(padded.kind, padded.tmdbId)).toBe(
			communityReportsTag(plain.kind, plain.tmdbId)
		);
	});

	it('answers 404 for an unknown kind or a non-numeric id', () => {
		for (const [kind, id] of [
			['person', '1'],
			['movie', 'abc'],
			['movie', '']
		])
			expect(() => parseTitleParams(kind, id)).toThrow();
	});
});
