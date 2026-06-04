<script lang="ts">
	import type { UmCandidate } from '$lib/movie/metrics.js';

	interface Props {
		candidates: UmCandidate[];
		onselect: (candidate: UmCandidate) => void;
	}

	let { candidates, onselect }: Props = $props();
</script>

<div class="um-candidates">
	<p class="intro">
		We found {candidates.length} possible Unconsenting Media matches for this title — which one is this
		title?
	</p>
	<ul role="list" class="candidate-list">
		{#each candidates as candidate (candidate.umId)}
			<li class="candidate-row">
				<button
					type="button"
					class="candidate-btn"
					onclick={() => onselect(candidate)}
					aria-label="Show Unconsenting Media data for {candidate.cleanName}{candidate.year
						? ` (${candidate.year})`
						: ''}"
				>
					<span class="candidate-icon" aria-hidden="true">
						<i class="ri-shield-cross-line"></i>
					</span>
					<span class="candidate-info">
						<span class="candidate-title">{candidate.cleanName}</span>
						{#if candidate.year}
							<span class="candidate-meta">
								<i class="ri-film-line" aria-hidden="true"></i>
								<span>{candidate.year}</span>
							</span>
						{/if}
					</span>
					<span
						class="flag-pill"
						aria-label="{candidate.flagCount} concern{candidate.flagCount === 1 ? '' : 's'}"
					>
						{candidate.flagCount} concern{candidate.flagCount === 1 ? '' : 's'}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.um-candidates {
		@apply flex flex-col gap-sm;
	}

	.intro {
		@apply text-sm text-ink-muted;
	}

	.candidate-list {
		@apply flex flex-col gap-xs list-none m-0 p-0;
	}

	.candidate-btn {
		@apply flex flex-row items-center gap-sm p-xs w-full rounded-sm text-left cursor-pointer no-underline text-ink;
		background: none;
		border: none;
		transition: background-color 0.1s ease;
	}

	.candidate-btn:hover {
		@apply bg-accent-bg text-accent-ink;
	}

	.candidate-btn:focus-visible {
		@apply outline-none;
		box-shadow: 0 0 0 2px var(--brand);
	}

	.candidate-icon {
		@apply flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-base;
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		color: var(--brand);
	}

	.candidate-btn:hover .candidate-icon {
		background-color: color-mix(in oklab, var(--accent) 20%, transparent);
		color: var(--accent-ink);
	}

	.candidate-info {
		@apply flex flex-col min-w-0 flex-1;
	}

	.candidate-title {
		@apply font-medium text-sm leading-snug truncate;
	}

	.candidate-meta {
		@apply flex flex-row items-center gap-xs text-xs text-ink-muted;
	}

	.candidate-btn:hover .candidate-meta {
		@apply text-accent-ink opacity-80;
	}

	.candidate-meta i {
		@apply text-[0.8rem] leading-none opacity-70;
	}

	.flag-pill {
		@apply text-xs font-medium px-xs py-0 rounded-full shrink-0;
		background-color: color-mix(in oklab, var(--warn) 15%, transparent);
		color: var(--warn);
	}
</style>
