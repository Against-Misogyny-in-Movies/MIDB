import { describe, it, expect } from 'vitest';
import { chunkForD1 } from '../chunkForD1.ts';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('chunkForD1', () => {
	it('returns no chunks for no rows', () => {
		expect(chunkForD1([], 5)).toEqual([]);
	});

	it('keeps rows * columns at or under 100 per chunk', () => {
		const chunks = chunkForD1(range(250), 7);
		expect(chunks.every((c) => c.length * 7 <= 100)).toBe(true);
		expect(chunks[0]).toHaveLength(14);
		expect(chunks.flat()).toEqual(range(250));
	});

	it('fits exactly 100 single-parameter values in one chunk', () => {
		expect(chunkForD1(range(100), 1)).toHaveLength(1);
		expect(chunkForD1(range(101), 1)).toHaveLength(2);
	});

	it('leaves room for the parameters the rest of the statement binds', () => {
		const chunks = chunkForD1(range(100), 1, 2);
		expect(chunks[0]).toHaveLength(98);
		expect(chunks).toHaveLength(2);
	});

	it('does not mutate its input', () => {
		const rows = range(30);
		chunkForD1(rows, 10);
		expect(rows).toEqual(range(30));
	});

	it('throws when one row cannot fit', () => {
		expect(() => chunkForD1([1], 101)).toThrow('exceeds D1');
		expect(() => chunkForD1([1], 5, 98)).toThrow('exceeds D1');
	});
});
