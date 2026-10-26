<script lang="ts">
	import { BECHDEL_TIERS } from '$lib/media/utils/metrics';

	// The three cumulative criteria (levels 0–2); the fourth tier is the "passes" outcome.
	const criteria = BECHDEL_TIERS.slice(0, 3);
</script>

<figure class="example" aria-label="Bechdel Test steps">
	<ol>
		{#each criteria as criterion (criterion.level)}
			<li>
				<span class="marker" aria-hidden="true">{criterion.level + 1}</span>
				<span>{criterion.label}</span>
			</li>
		{/each}
	</ol>
</figure>

<style lang="postcss">
	@reference "../../../app.css";

	.example {
		@apply m-0 rounded-md p-md;
		background-color: var(--surface-sunken);
	}
	ol {
		@apply flex flex-col list-none m-0 p-0;
	}

	/* Shared marker pattern: see .CLAUDE/architecture.md. */
	li {
		@apply flex items-center gap-sm text-sm text-ink font-medium;
		padding-block: var(--spacing-xs);
	}

	.marker {
		@apply flex items-center justify-center rounded-full text-xs font-semibold shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		color: var(--brand);
	}
</style>
