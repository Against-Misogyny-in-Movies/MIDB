import { deviceName, DEFAULT_PASSKEY_NAME } from '#lib/media/utils/deviceName.ts';

/** The label for a session whose user agent names neither a browser nor a system. */
export const UNKNOWN_DEVICE = 'Unknown device';

export interface UserAgentSummary {
	/** `Firefox on macOS`, or `Firefox` or `macOS` alone, or `Unknown device`. */
	label: string;
	/** A phone, so the row can show a phone icon. */
	mobile: boolean;
}

/**
 * The browser and operating system a stored user agent names, read with the tables that name a
 * passkey's device (`deviceName.ts`). A missing or unrecognised agent is `Unknown device`.
 */
export function readUserAgent(userAgent: string | null | undefined): UserAgentSummary {
	const agent = userAgent ?? '';
	const label = deviceName({ userAgent: agent });
	return {
		label: label === DEFAULT_PASSKEY_NAME ? UNKNOWN_DEVICE : label,
		mobile: /iPhone|iPod|Android/.test(agent)
	};
}
