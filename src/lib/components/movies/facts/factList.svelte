<script lang="ts">
	interface Props {
		facts: { label: string; value: string }[];
	}

	let { facts }: Props = $props();
</script>

<dl class="facts">
	{#each facts as fact (fact.label)}
		<div class="fact">
			<dt>{fact.label}</dt>
			<dd>{fact.value}</dd>
		</div>
	{/each}
</dl>

<style lang="postcss">
	@reference "../../../../app.css";

	.facts {
		@apply grid;
		grid-template-columns: 1fr;
		column-gap: var(--spacing-lg);
	}

	@media (min-width: 768px) {
		.facts {
			grid-template-columns: 1fr 1fr;
		}
	}

	.fact {
		@apply grid gap-md border-b border-border;
		grid-template-columns: 8rem minmax(0, 1fr);
		padding-block: var(--spacing-sm);
	}

	dt {
		@apply text-ink-muted;
	}

	dd {
		@apply text-ink;
	}
</style>
