<script lang="ts">
	import type { Snippet } from 'svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import DddTags from './dddTags.svelte';
	import DddCategoryFilter from './dddCategoryFilter.svelte';
	import { dddStatus } from '#lib/media/utils/dddStatus.ts';
	import { dddUrl } from '#lib/media/utils/metrics.ts';
	import type { DddResult, TriggerTag } from '#lib/media/types/ddd.ts';

	interface Props {
		ddd: DddResult | null;
		visibleTags: TriggerTag[];
		selector?: Snippet;
		/** A season (or episode) is picked, so no warnings reads "No warnings". */
		seasonPicked?: boolean;
	}

	let { ddd, visibleTags, selector, seasonPicked = false }: Props = $props();

	let selectedCategory = $state<string | null>(null);

	// Reset filter when the tag set changes (e.g. episode switch)
	$effect(() => {
		void visibleTags;
		selectedCategory = null;
	});

	const status = $derived(dddStatus(ddd, visibleTags.length, seasonPicked));

	const filteredTags = $derived(
		selectedCategory === null
			? visibleTags
			: visibleTags.filter((t) => t.category === selectedCategory)
	);
</script>

<CollapsibleSection
	title="Does the Dog Die"
	icon="ri-alarm-warning-fill"
	hue="var(--src-ddd)"
	id="ddd"
	openOnHash
	status={status.label}
	busy={status.busy}
	open={false}
	sourceLabel="DoesTheDogDie.com"
	sourceHref={dddUrl(ddd?.itemId ?? null)}
	learnHref="/resources#ddd"
>
	{#if ddd === null}
		<div class="skeleton" role="status" aria-busy="true">
			<span class="sr-only">Loading warnings</span>
			<div class="skeleton-row"></div>
			<div class="skeleton-row"></div>
			<div class="skeleton-row"></div>
		</div>
	{:else}
		{#if selector || visibleTags.length > 0}
			<div class="controls">
				{@render selector?.()}
				{#if visibleTags.length > 0}
					<DddCategoryFilter
						tags={visibleTags}
						{selectedCategory}
						onchange={(cat) => (selectedCategory = cat)}
					/>
				{/if}
			</div>
		{/if}
		{#if visibleTags.length > 0}
			<DddTags tags={filteredTags} />
		{:else}
			<p class="no-data">No warnings on Does the Dog Die.</p>
		{/if}
	{/if}
</CollapsibleSection>

<style lang="postcss">
	@reference "../../../../app.css";

	.no-data {
		@apply text-ink-muted;
	}

	.controls {
		@apply flex flex-wrap items-center gap-md;
	}

	.controls:empty {
		display: none;
	}

	.skeleton {
		@apply flex flex-col;
	}

	.skeleton-row {
		@apply border-b border-border;
		height: 2.375rem;
		background: linear-gradient(var(--surface-sunken), var(--surface-sunken)) left center / 40%
			0.75rem no-repeat;
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-row {
			animation: none;
		}
	}
</style>
