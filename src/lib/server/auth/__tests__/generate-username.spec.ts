import { describe, it, expect, vi } from 'vitest';
import { FEMINIST_ICONS, ICON_NAME_MAX } from '#lib/media/utils/feminist-icons.ts';
import { NEW_USERNAME_RE } from '#lib/media/utils/username.ts';
import { USERNAME_ATTEMPTS, generateUsername, randomUsername } from '../generate-username.ts';

describe('the icon list', () => {
	it('holds distinct, short, lowercase ASCII names', () => {
		expect(new Set(FEMINIST_ICONS).size).toBe(FEMINIST_ICONS.length);
		expect(FEMINIST_ICONS.length).toBeGreaterThanOrEqual(40);
		for (const icon of FEMINIST_ICONS) {
			expect(icon).toMatch(/^[a-z]+(_[a-z]+)*$/);
			expect(icon.length).toBeLessThanOrEqual(ICON_NAME_MAX);
		}
	});

	it('makes every name plus four digits a valid username', () => {
		for (const icon of FEMINIST_ICONS) expect(`${icon}_9999`).toMatch(NEW_USERNAME_RE);
	});
});

describe('randomUsername', () => {
	it('is an icon, an underscore and four digits, and a valid username', () => {
		for (let i = 0; i < 200; i++) {
			const name = randomUsername();
			expect(name).toMatch(NEW_USERNAME_RE);
			const match = /^(.+)_(\d{4})$/.exec(name);
			expect(match).not.toBeNull();
			expect(FEMINIST_ICONS).toContain(match![1]);
		}
	});

	it('varies', () => {
		expect(new Set(Array.from({ length: 50 }, randomUsername)).size).toBeGreaterThan(1);
	});
});

describe('generateUsername', () => {
	it('returns the first free candidate', async () => {
		const isTaken = vi.fn().mockResolvedValue(false);
		expect(await generateUsername(isTaken)).toMatch(NEW_USERNAME_RE);
		expect(isTaken).toHaveBeenCalledTimes(1);
	});

	it('draws again after a collision', async () => {
		const isTaken = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
		isTaken.mockResolvedValue(false);
		await generateUsername(isTaken);
		expect(isTaken).toHaveBeenCalledTimes(3);
	});

	it('throws after the bounded number of attempts', async () => {
		const isTaken = vi.fn().mockResolvedValue(true);
		await expect(generateUsername(isTaken)).rejects.toThrow(/No free username/);
		expect(isTaken).toHaveBeenCalledTimes(USERNAME_ATTEMPTS);
	});
});
