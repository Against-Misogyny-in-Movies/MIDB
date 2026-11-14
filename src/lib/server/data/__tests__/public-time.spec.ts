import { describe, expect, it } from 'vitest';
import { publicTime } from '#lib/server/data/public-time.ts';

describe('publicTime', () => {
	it('rounds down to the minute, never up', () => {
		expect(publicTime(new Date('2026-11-01T10:07:59.999Z'))).toBe('2026-11-01T10:07:00.000Z');
		expect(publicTime(new Date('2026-11-01T10:08:00.000Z'))).toBe('2026-11-01T10:08:00.000Z');
	});
});
