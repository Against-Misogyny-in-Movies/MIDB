<script lang="ts">
	import { BECHDEL_TIERS } from '$lib/media/utils/metrics';

	// The three cumulative criteria (levels 0–2); the fourth tier is the "passes" outcome.
	const criteria = BECHDEL_TIERS.slice(0, 3);
</script>

<div class="example">
	<p class="example-caption">A film earns one point for each step it clears:</p>
	<ol class="bechdel-criteria">
		{#each criteria as criterion (criterion.level)}
			<li class="criterion criterion--met">
				<span class="criterion-marker" aria-hidden="true">{criterion.level + 1}</span>
				<span class="criterion-label">{criterion.label}</span>
			</li>
		{/each}
	</ol>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.example {
		@apply flex flex-col gap-sm;
	}

	.example-caption {
		@apply text-sm text-ink-muted;
	}

	.bechdel-criteria {
		@apply flex flex-col list-none m-0 p-0;
	}

	.criterion {
		@apply relative flex items-center gap-sm text-sm text-ink-muted;
		padding-block: var(--spacing-xs);
	}

	.criterion:not(:last-child)::before {
		content: '';
		@apply absolute;
		left: 0.6875rem; /* centre of the 1.375rem marker */
		top: calc(50% + 0.6875rem);
		bottom: calc(50% - 0.6875rem - var(--spacing-xs) * 2);
		width: 2px;
		background-color: var(--border);
	}

	.criterion--met:not(:last-child)::before {
		background-color: color-mix(in oklab, var(--success) 45%, var(--border));
	}

	.criterion--met {
		@apply text-ink font-medium;
	}

	.criterion-marker {
		@apply flex items-center justify-center rounded-full text-xs font-semibold shrink-0 z-10;
		width: 1.375rem;
		height: 1.375rem;
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.criterion--met .criterion-marker {
		background-color: color-mix(in oklab, var(--success) 16%, transparent);
		color: var(--success);
	}

	.criterion-label {
		@apply leading-snug;
	}
</style>
