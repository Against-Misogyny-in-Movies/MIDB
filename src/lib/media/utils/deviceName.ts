/** What the browser reports about itself; `userAgentData` is absent in Firefox and Safari. */
export interface DeviceInfo {
	userAgent: string;
	/** `navigator.userAgentData?.platform`, e.g. "macOS" or "Windows". */
	platform?: string;
	/** `navigator.userAgentData?.brands[].brand`. */
	brands?: string[];
}

/** The fallback when neither the browser nor the system can be told. */
export const DEFAULT_PASSKEY_NAME = 'Passkey';

/** Brands the UA string names, most specific first (Edge and Opera also say "Chrome"). */
const BROWSERS: [RegExp, string][] = [
	[/Edg(?:e|A|iOS)?\//, 'Edge'],
	[/OPR\/|Opera/, 'Opera'],
	[/SamsungBrowser\//, 'Samsung Internet'],
	[/Firefox\/|FxiOS\//, 'Firefox'],
	[/Chrome\/|CriOS\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

/** Systems the UA string names; iOS before macOS because iPad UAs say "Mac OS X". */
const SYSTEMS: [RegExp, string][] = [
	[/iPhone|iPad|iPod/, 'iOS'],
	[/Android/, 'Android'],
	[/CrOS/, 'ChromeOS'],
	[/Windows/, 'Windows'],
	[/Macintosh|Mac OS X/, 'macOS'],
	[/Linux|X11/, 'Linux']
];

/** Brands in `userAgentData` that are not a browser name. */
const GENERIC_BRANDS = /^(Chromium|Not.*Brand)/i;

function firstMatch(table: [RegExp, string][], text: string): string | undefined {
	return table.find(([pattern]) => pattern.test(text))?.[1];
}

function systemFromPlatform(platform?: string): string | undefined {
	if (!platform) return undefined;
	return platform === 'Chrome OS' ? 'ChromeOS' : platform;
}

/**
 * A readable name for the passkey being made, such as "Chrome on macOS", so a list of a
 * reader's passkeys can be told apart. Derived from what the browser reports, with no library.
 */
export function deviceName({ userAgent, platform, brands }: DeviceInfo): string {
	const browser =
		brands?.find((brand) => !GENERIC_BRANDS.test(brand))?.replace(/^Google Chrome$/, 'Chrome') ??
		firstMatch(BROWSERS, userAgent);
	const system = systemFromPlatform(platform) ?? firstMatch(SYSTEMS, userAgent);
	if (browser && system) return `${browser} on ${system}`;
	return browser ?? system ?? DEFAULT_PASSKEY_NAME;
}

/** `deviceName` for the running browser. */
export function currentDeviceName(): string {
	const data = (
		navigator as Navigator & {
			userAgentData?: { platform?: string; brands?: { brand: string }[] };
		}
	).userAgentData;
	return deviceName({
		userAgent: navigator.userAgent,
		platform: data?.platform,
		brands: data?.brands?.map((b) => b.brand)
	});
}
