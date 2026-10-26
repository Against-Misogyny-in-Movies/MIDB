<script lang="ts">
	import { UM_FLAGS } from '$lib/media/utils/metrics';
</script>

<figure class="example">
	<figcaption>The nine flags, with how each one reads on a title when present:</figcaption>
	<ul>
		{#each UM_FLAGS as flag (flag.key)}
			{@const reassurance = flag.key === 'noRape'}
			<li class:reassurance>
				<span class="marker" aria-hidden="true">
					<i class={reassurance ? 'ri-check-line' : 'ri-alert-line'}></i>
				</span>
				<span>{flag.label}</span>
			</li>
		{/each}
	</ul>
</figure>

<style lang="postcss">
	@reference "../../../app.css";

	.example {
		@apply flex flex-col gap-sm m-0 rounded-md p-md;
		background-color: var(--surface-sunken);
	}

	figcaption {
		@apply text-sm text-ink-muted;
	}

	/* Mirrors umMetricSection.svelte so the explainer matches the live section. */
	ul {
		@apply grid list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0 var(--spacing-lg);
	}

	li {
		@apply flex items-center gap-sm text-sm text-ink font-medium;
		padding-block: var(--spacing-xs);
	}

	.marker {
		@apply flex items-center justify-center rounded-full text-xs shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		background-color: var(--warn-soft);
		color: var(--warn);
	}

	.reassurance .marker {
		background-color: var(--success-soft);
		color: var(--success);
	}
</style>
