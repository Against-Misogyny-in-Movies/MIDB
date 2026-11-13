import {
	AnthropicError,
	APIConnectionTimeoutError,
	APIUserAbortError,
	RateLimitError
} from '@anthropic-ai/sdk';
import type { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { getAnthropic } from '#lib/server/integrations/anthropic.ts';
import { env } from '#lib/server/env.ts';

/** Why a model call gave no answer. Each caller decides what its failure means. */
export type ModelFailure =
	| 'ai-unavailable'
	| 'ai-refusal'
	| 'ai-truncated'
	| 'ai-unparsed'
	| 'ai-timeout'
	| 'ai-rate-limited'
	| 'ai-error';

/** The model when `MODERATION_MODEL` (`wrangler.jsonc`) is unset. */
const DEFAULT_MODEL = 'claude-haiku-5-5';

/** The model a call uses. */
export const moderationModel = () => env.MODERATION_MODEL || DEFAULT_MODEL;

/** Keeps data from closing its own tag: a `<` in data never starts a tag. */
export const asData = (text: string) => text.replaceAll('<', '&lt;');

export function failureCode(error: unknown): ModelFailure {
	if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError) {
		return 'ai-timeout';
	}
	if (error instanceof RateLimitError) return 'ai-rate-limited';
	return 'ai-error';
}

/**
 * Reads the model's JSON text: the SDK's parse for the shape, then the strict schema for the
 * ranges. `null` when the text is not JSON of the shape, or the strict schema refuses it.
 */
export function readStructured<Loose extends z.ZodType, Strict extends z.ZodType>(
	text: string,
	format: ReturnType<typeof zodOutputFormat<Loose>>,
	strictSchema: Strict
): z.infer<Strict> | null {
	let loose;
	try {
		loose = format.parse(text);
	} catch (error) {
		if (error instanceof AnthropicError) return null;
		throw error;
	}
	const strict = strictSchema.safeParse(loose);
	return strict.success ? strict.data : null;
}

export interface StructuredCall<Schema extends z.ZodType> {
	/** Frozen text: nothing a user wrote is ever put into it. */
	system: string;
	/** The user turn, with every piece of user text passed through `asData`. */
	user: string;
	format: ReturnType<typeof zodOutputFormat<Schema>>;
	maxTokens: number;
	/** The whole call, retries and their waits included, ends within this many milliseconds. */
	deadlineMs: number;
	/** One attempt may take this long. Unset, the client's own timeout applies. */
	timeoutMs?: number;
	/** Retries after a failed attempt. Unset, the client's own count applies. */
	maxRetries?: number;
}

/**
 * Sends one structured-output request and returns the answer's text, or the failure. The
 * request is `messages.create`, not `messages.parse`, so the stop reason is read before the
 * text is: the SDK's parse throws on a refusal or a truncation and hides which.
 */
export async function callStructured<Schema extends z.ZodType>(
	call: StructuredCall<Schema>
): Promise<{ ok: true; text: string; model: string } | { ok: false; code: ModelFailure }> {
	const client = getAnthropic();
	if (!client) return { ok: false, code: 'ai-unavailable' };
	const model = moderationModel();

	try {
		const response = await client.messages.create(
			{
				model,
				max_tokens: call.maxTokens,
				thinking: { type: 'disabled' },
				output_config: { effort: 'low', format: call.format },
				system: call.system,
				messages: [{ role: 'user', content: call.user }]
			},
			{
				signal: AbortSignal.timeout(call.deadlineMs),
				...(call.timeoutMs !== undefined && { timeout: call.timeoutMs }),
				...(call.maxRetries !== undefined && { maxRetries: call.maxRetries })
			}
		);
		if (response.stop_reason === 'refusal') return { ok: false, code: 'ai-refusal' };
		if (response.stop_reason === 'max_tokens') return { ok: false, code: 'ai-truncated' };
		const block = response.content.find((b) => b.type === 'text');
		if (!block) return { ok: false, code: 'ai-unparsed' };
		return { ok: true, text: block.text, model };
	} catch (error) {
		return { ok: false, code: failureCode(error) };
	}
}
