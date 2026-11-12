import Anthropic from '@anthropic-ai/sdk';
import { env } from '#lib/server/env.ts';

/** A moderation call that has not answered in this many milliseconds counts as a failure. */
export const ANTHROPIC_TIMEOUT_MS = 8000;

/**
 * The Anthropic client for this request, or `null` when `ANTHROPIC_API_KEY` is unset (comments
 * then wait for a moderator). Built per call from the Worker's env, never at module load.
 */
export function getAnthropic(): Anthropic | null {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	return new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS, maxRetries: 1 });
}
