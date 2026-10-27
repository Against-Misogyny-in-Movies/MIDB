<script lang="ts">
	import Badge from '$lib/components/ui/badge.svelte';
	import { umFlagCount } from '$lib/media/utils/metrics';
	import { umTone } from '$lib/media/utils/tones';
	import type { UmEntry } from '$lib/media/types/um';

	interface Props {
		candidates: UmEntry[];
		onselect: (candidate: UmEntry) => void;
	}

	let { candidates, onselect }: Props = $props();
</script>

<div class="um-candidates">
	<p class="intro">
		{candidates.length} Unconsenting Media entries could match this title. Select one to show its flags.
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
					<span class="year">{candidate.year ?? '—'}</span>
					<span class="candidate-title">{candidate.cleanName}</span>
					<Badge tone={umTone(candidate)}>{concerns} concern{concerns === 1 ? '' : 's'}</Badge>
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
		@apply flex flex-col list-none m-0 p-0 overflow-hidden;
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.candidate-list li + li {
		border-top: 1px solid var(--border);
	}

	.candidate {
		@apply flex items-center w-full text-left bg-transparent border-0 cursor-pointer text-ink;
		gap: 12px;
		padding: 10px 12px;
		font: inherit;
		transition: background-color 0.15s ease;
	}

	.candidate:hover {
		background-color: var(--surface-sunken);
	}

	.candidate:focus-visible {
		outline-offset: -2px;
	}

	.year {
		@apply flex items-center justify-center shrink-0;
		width: 2.75rem;
		height: 2rem;
		border-radius: 8px;
		background-color: var(--brand-wash);
		color: var(--brand);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.candidate-title {
		@apply font-medium flex-1 min-w-0 truncate;
	}
</style>
