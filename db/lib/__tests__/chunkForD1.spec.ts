import { describe, it, expect } from 'vitest';
import { chunkForD1, D1_MAX_PARAMS } from '../chunkForD1.ts';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('chunkForD1', () => {
	it('returns no chunks for no rows', () => {
		expect(chunkForD1([], 5)).toEqual([]);
	});

	it('keeps rows * columns at or under the limit per chunk', () => {
		const chunks = chunkForD1(range(250), 7);
		expect(chunks.every((c) => c.length * 7 <= D1_MAX_PARAMS)).toBe(true);
		expect(chunks[0]).toHaveLength(14);
		expect(chunks.flat()).toEqual(range(250));
	});

	it('fits exactly the limit of single-parameter values in one chunk', () => {
		expect(chunkForD1(range(D1_MAX_PARAMS), 1)).toHaveLength(1);
		expect(chunkForD1(range(D1_MAX_PARAMS + 1), 1)).toHaveLength(2);
	});

	it('leaves room for the parameters the rest of the statement binds', () => {
		const chunks = chunkForD1(range(D1_MAX_PARAMS), 1, 2);
		expect(chunks[0]).toHaveLength(D1_MAX_PARAMS - 2);
		expect(chunks).toHaveLength(2);
	});

	it('counts the columns and the reserved SET parameters against the limit', () => {
		// An upsert of 11-column rows whose SET binds one value: (100 - 1) / 11 = 9 rows.
		const chunks = chunkForD1(range(20), 11, 1);
		expect(chunks[0]).toHaveLength(9);
		expect(chunks.every((c) => c.length * 11 + 1 <= D1_MAX_PARAMS)).toBe(true);
		expect(chunkForD1(range(20), 11)[0]).toHaveLength(9);
		expect(chunkForD1(range(20), 11, 2)[0]).toHaveLength(8);
	});

	it('does not mutate its input', () => {
		const rows = range(30);
		chunkForD1(rows, 10);
		expect(rows).toEqual(range(30));
	});

	it('throws when one row cannot fit', () => {
		expect(() => chunkForD1([1], D1_MAX_PARAMS + 1)).toThrow('exceeds D1');
		expect(() => chunkForD1([1], 5, D1_MAX_PARAMS - 2)).toThrow('exceeds D1');
	});
});
