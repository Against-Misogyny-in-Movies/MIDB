<script lang="ts">
	import { umFlagCount } from '$lib/media/utils/metrics';
	import type { UmEntry } from '$lib/media/types/um';

	interface Props {
		candidates: UmEntry[];
		onselect: (candidate: UmEntry) => void;
	}

	let { candidates, onselect }: Props = $props();
</script>

<div class="um-candidates">
	<p class="intro">
		The Unconsenting Media dataset has {candidates.length} entries that could match this title. Choosing
		one shows its flags.
	</p>
	<ul role="list" class="candidate-list">
		{#each candidates as candidate (candidate.umId)}
			{@const concerns = umFlagCount(candidate)}
			<li>
				<button
					type="button"
					class="candidate"
					onclick={() => onselect(candidate)}
					aria-label="Show Unconsenting Media data for {candidate.cleanName}{candidate.year
						? ` (${candidate.year})`
						: ''}"
				>
					<span class="candidate-title">{candidate.cleanName}</span>
					{#if candidate.year}
						<span class="candidate-year tabular-nums">{candidate.year}</span>
					{/if}
					<span class="candidate-concerns tabular-nums">
						{concerns} concern{concerns === 1 ? '' : 's'}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.um-candidates {
		@apply flex flex-col gap-sm;
	}

	.intro {
		@apply text-ink-muted;
		max-width: 65ch;
	}

	.candidate-list {
		@apply flex flex-col list-none m-0 p-0 border-t border-border;
	}

	.candidate {
		@apply flex items-baseline gap-md w-full text-left bg-transparent border-0 border-b border-border cursor-pointer text-ink;
		padding: var(--spacing-sm) var(--spacing-xs);
		font: inherit;
		transition: background-color 0.15s ease;
	}

	.candidate:hover {
		background-color: var(--surface-sunken);
	}

	.candidate-title {
		@apply font-medium flex-1 min-w-0 truncate;
	}

	.candidate-year,
	.candidate-concerns {
		@apply text-sm text-ink-muted shrink-0;
	}
</style>
