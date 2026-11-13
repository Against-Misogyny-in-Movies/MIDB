<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Notice from '#lib/components/ui/notice.svelte';
	import { AI_QUERY_MAX, SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
	import { toastActionResult } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		aiAvailable: boolean;
		/** The ids of the comments on the page, which a scan checks. */
		ids: string[];
	}

	let { aiAvailable, ids }: Props = $props();

	let searching = $state(false);
	let scanning = $state(false);

	/** The search asks for filters, then opens the table with them, so they show as chips to edit. */
	const search = () => {
		searching = true;
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			searching = false;
			const params = result.type === 'success' ? result.data?.params : undefined;
			if (typeof params === 'string') {
				toastActionResult(result);
				await goto(params ? `?tab=table&${params}` : '?tab=table', { reset: false });
			} else {
				toastActionResult(result);
			}
		};
	};

	/** A scan saves its labels, so the page reloads to show them. */
	const scan = () => {
		scanning = true;
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (options?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			scanning = false;
			toastActionResult(result);
		};
	};
</script>

<section class="card ai" aria-label="AI search and scan" aria-busy={searching || scanning}>
	{#if !aiAvailable}
		<Notice tone="warn">AI search and scan are off: this site has no API key set.</Notice>
	{/if}
	<div class="forms">
		<form method="POST" action="?/aiSearch" use:enhance={search} aria-busy={searching}>
			<label class="field">
				<span class="label">Search in plain words</span>
				<input
					class="input"
					name="query"
					maxlength={AI_QUERY_MAX}
					autocomplete="off"
					placeholder="Trolling replies from this week"
					disabled={!aiAvailable || searching}
					required
				/>
			</label>
			<p class="label">The description becomes filters, which show below to change.</p>
			<button class="btn btn--ink" aria-busy={searching} disabled={!aiAvailable || searching}>
				Search with AI
			</button>
		</form>

		<form method="POST" action="?/scan" use:enhance={scan} aria-busy={scanning}>
			{#each ids as id (id)}
				<input type="hidden" name="ids" value={id} />
			{/each}
			<label class="field">
				<span class="label">Concern to scan for</span>
				<input
					class="input"
					name="concern"
					maxlength={SCAN_CONCERN_MAX}
					autocomplete="off"
					placeholder="Disparaging remarks about survivors"
					disabled={!aiAvailable || scanning}
					required
				/>
			</label>
			<p class="label">The scan checks the comments on this page and saves what it finds.</p>
			<button
				class="btn btn--ink"
				aria-busy={scanning}
				disabled={!aiAvailable || scanning || ids.length === 0}
			>
				Scan this page
			</button>
		</form>
	</div>
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.ai {
		@apply flex flex-col;
		gap: var(--spacing-md);
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
