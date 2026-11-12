import { describe, it, expect } from 'vitest';
import { deviceName } from '../deviceName.ts';

const CHROME_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const EDGE_WIN =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const SAFARI_IPAD =
	'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAFARI_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

describe('deviceName', () => {
	it('names the browser and the system from the user agent', () => {
		expect(deviceName({ userAgent: CHROME_MAC })).toBe('Chrome on macOS');
		expect(deviceName({ userAgent: EDGE_WIN })).toBe('Edge on Windows');
		expect(deviceName({ userAgent: FIREFOX_LINUX })).toBe('Firefox on Linux');
		expect(deviceName({ userAgent: SAFARI_MAC })).toBe('Safari on macOS');
		expect(deviceName({ userAgent: CHROME_ANDROID })).toBe('Chrome on Android');
	});

	it('calls an iPad iOS, although its user agent says Mac OS X', () => {
		expect(deviceName({ userAgent: SAFARI_IPAD })).toBe('Safari on iOS');
	});

	it('prefers userAgentData, skipping the generic brands', () => {
		expect(
			deviceName({
				userAgent: CHROME_MAC,
				platform: 'macOS',
				brands: ['Not?A_Brand', 'Chromium', 'Google Chrome']
			})
		).toBe('Chrome on macOS');
		expect(
			deviceName({ userAgent: '', platform: 'Chrome OS', brands: ['Chromium', 'Brave'] })
		).toBe('Brave on ChromeOS');
	});

	it('falls back to what it can tell, then to "Passkey"', () => {
		expect(deviceName({ userAgent: 'curl/8', platform: 'Linux' })).toBe('Linux');
		expect(deviceName({ userAgent: 'Firefox/132.0' })).toBe('Firefox');
		expect(deviceName({ userAgent: '' })).toBe('Passkey');
	});
});
