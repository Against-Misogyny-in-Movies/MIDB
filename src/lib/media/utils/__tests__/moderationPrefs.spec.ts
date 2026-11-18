import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE_SEVERE_KEY, ModerationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';

afterEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe('ModerationPrefs', () => {
	it('defaults to on, with nothing stored', () => {
		const prefs = new ModerationPrefs();
		prefs.start();
		expect(prefs.collapseSevere).toBe(true);
		expect(localStorage.length).toBe(0);
	});

	it('stores the setting only when it is off, and removes it when it is on again', () => {
		const prefs = new ModerationPrefs();
		prefs.setCollapseSevere(false);
		expect(localStorage.getItem(COLLAPSE_SEVERE_KEY)).toBe('off');
		prefs.setCollapseSevere(true);
		expect(localStorage.getItem(COLLAPSE_SEVERE_KEY)).toBeNull();
	});

	it('reads what a visit stored', () => {
		localStorage.setItem(COLLAPSE_SEVERE_KEY, 'off');
		const prefs = new ModerationPrefs();
		prefs.start();
		expect(prefs.collapseSevere).toBe(false);
	});

	it('keeps the defaults and the choice for the page when storage throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		const prefs = new ModerationPrefs();
		prefs.start();
		expect(prefs.collapseSevere).toBe(true);
		prefs.setCollapseSevere(false);
		expect(prefs.collapseSevere).toBe(false);
	});
});
