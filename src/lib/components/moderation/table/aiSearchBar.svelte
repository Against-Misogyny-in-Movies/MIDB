<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Notice from '#lib/components/ui/notice.svelte';
	import { AI_QUERY_MAX, SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { toastActionResult } from '#lib/media/utils/rowSubmit.ts';
	import { TABLE_FOCUS } from '#lib/media/utils/tableChips.ts';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';

	interface Props {
		aiAvailable: boolean;
		/** The ids of the comments on the page, which a scan checks. */
		ids: string[];
	}

	let { aiAvailable, ids }: Props = $props();

	type Result = {
		type: string;
		data?: Record<string, unknown>;
		error?: { message?: unknown };
	};

	let searching = $state(false);
	let scanning = $state(false);

	/** A thrown error (the rate limit's 429 among them) says what it carries; a refusal the action returned reads as any other. */
	function report(result: Result) {
		if (result.type !== 'error') return toastActionResult(result);
		const message = result.error?.message;
		toasts.error(
			typeof message === 'string' && message
				? message
				: 'The request failed. Try again in a moment.'
		);
	}

	/**
	 * The search asks for filters, then opens the table with them, so they show as chips to edit.
	 * The field is read-only while it runs, not disabled, so the focus stays; the focus then
	 * moves to the chips, or to the table when the search set no filter.
	 */
	const search = ({ cancel }: { cancel: () => void }) => {
		if (searching) {
			cancel();
			return;
		}
		searching = true;
		return async ({ result }: { result: Result }) => {
			searching = false;
			report(result);
			const params = result.type === 'success' ? result.data?.params : undefined;
			if (typeof params !== 'string') return;
			await goto(params ? `?tab=table&${params}` : '?tab=table', { reset: false });
			await focusAfterUpdate(
				() =>
					document.getElementById(TABLE_FOCUS.chips) ?? document.getElementById(TABLE_FOCUS.card)
			);
		};
	};

	/** A scan saves its labels, so the page reloads to show them. */
	const scan = ({ cancel }: { cancel: () => void }) => {
		if (scanning) {
			cancel();
			return;
		}
		scanning = true;
		return async ({
			result,
			update
		}: {
			result: Result;
			update: (options?: { reset?: boolean; navigate?: boolean }) => Promise<void>;
		}) => {
			// An error result would render the error page over the table, so only a result the page can apply is applied.
			if (result.type !== 'error') await update({ reset: false, navigate: false });
			scanning = false;
			report(result);
		};
	};
</script>

{#if !aiAvailable}
	<Notice tone="warn">AI search and scan are off: this site has no API key set.</Notice>
{:else}
	<section class="card ai" aria-label="AI search and scan">
		<div class="forms">
			<form method="POST" action="?/aiSearch" use:enhance={search}>
				<label class="field">
					<span class="label">Search in plain words</span>
					<input
						class="input"
						name="query"
						maxlength={AI_QUERY_MAX}
						autocomplete="off"
						placeholder="Trolling from this week, most reported first"
						readonly={searching}
						required
					/>
				</label>
				<p class="label">The description becomes filters, which show below to change.</p>
				<button class="btn btn--ink" aria-busy={searching} aria-disabled={searching}>
					Search with AI
				</button>
			</form>

			<form method="POST" action="?/scan" use:enhance={scan}>
				{#each ids as id (id)}
					<input type="hidden" name="ids" value={id} />
				{/each}
				<label class="field">
					<span class="label">Scan for</span>
					<input
						class="input"
						name="concern"
						maxlength={SCAN_CONCERN_MAX}
						autocomplete="off"
						placeholder="Disparaging remarks about survivors"
						readonly={scanning}
						required
					/>
				</label>
				<p class="label">
					The scan checks the comments on this page that are not deleted, and saves a label for each
					one the AI answers.
				</p>
				<button
					class="btn btn--ink"
					aria-busy={scanning}
					aria-disabled={scanning}
					disabled={ids.length === 0}
				>
					Scan this page
				</button>
			</form>
		</div>
	</section>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.ai {
		padding: var(--spacing-md);
	}

	.forms {
		@apply grid;
		gap: var(--spacing-md) var(--spacing-lg);
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}

	form {
		@apply flex flex-col items-start;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col w-full;
		gap: var(--spacing-xs);
	}
</style>
