import { describe, it, expect } from 'vitest';
import { readUserAgent, UNKNOWN_DEVICE } from '../userAgent.ts';

const AGENTS = {
	chromeMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	edgeWindows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
	firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
	safariMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
	safariIphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
	chromeIphone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
	chromeAndroid:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
	firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
	samsung:
		'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
	safariIpad:
		'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
};

describe('readUserAgent', () => {
	it.each([
		['chromeMac', 'Chrome on macOS'],
		['edgeWindows', 'Edge on Windows'],
		['firefoxLinux', 'Firefox on Linux'],
		['safariMac', 'Safari on macOS'],
		['safariIphone', 'Safari on iOS'],
		['chromeIphone', 'Chrome on iOS'],
		['chromeAndroid', 'Chrome on Android'],
		['firefoxAndroid', 'Firefox on Android'],
		['samsung', 'Samsung Internet on Android'],
		['safariIpad', 'Safari on iOS']
	] as const)('reads %s as %s', (name, label) => {
		expect(readUserAgent(AGENTS[name]).label).toBe(label);
	});

	it('marks a phone, and not a computer or a tablet', () => {
		expect(readUserAgent(AGENTS.safariIphone).mobile).toBe(true);
		expect(readUserAgent(AGENTS.chromeAndroid).mobile).toBe(true);
		expect(readUserAgent(AGENTS.chromeMac).mobile).toBe(false);
		expect(readUserAgent(AGENTS.safariIpad).mobile).toBe(false);
	});

	it('names what it can when only the browser or only the system is known', () => {
		expect(readUserAgent('Firefox/132.0').label).toBe('Firefox');
		expect(readUserAgent('(Windows NT 10.0)').label).toBe('Windows');
	});

	it('falls back to a plain label for a missing or unrecognised agent', () => {
		expect(readUserAgent(null)).toEqual({ label: UNKNOWN_DEVICE, mobile: false });
		expect(readUserAgent(undefined).label).toBe(UNKNOWN_DEVICE);
		expect(readUserAgent('').label).toBe(UNKNOWN_DEVICE);
		expect(readUserAgent('curl/8.5.0').label).toBe(UNKNOWN_DEVICE);
	});
});
