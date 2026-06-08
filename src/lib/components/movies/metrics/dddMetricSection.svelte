<script lang="ts">
	import type { Snippet } from 'svelte';
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import DddTags from './dddTags.svelte';
	import DddCategoryFilter from './dddCategoryFilter.svelte';
	import { dddUrl } from '$lib/media/utils/metrics';
	import type { DddResult, TriggerTag } from '$lib/media/types/ddd';

	interface Props {
		ddd: DddResult | null;
		visibleTags: TriggerTag[];
		mediaNoun: 'movie' | 'series';
		selector?: Snippet;
	}

	let { ddd, visibleTags, mediaNoun, selector }: Props = $props();

	let selectedCategory = $state<string | null>(null);

	// Reset filter when the tag set changes (e.g. episode switch)
	$effect(() => {
		visibleTags;
		selectedCategory = null;
	});

	const filteredTags = $derived(
		selectedCategory === null
			? visibleTags
			: visibleTags.filter((t) => t.category === selectedCategory),
	);
</script>

<div id="ddd">
	<CollapsibleSection
		title="Does the Dog Die"
		status={ddd === null
			? 'Loading…'
			: visibleTags.length > 0
				? `${visibleTags.length} trigger tag${visibleTags.length === 1 ? '' : 's'}`
				: 'No data'}
		tone={ddd === null ? 'loading' : visibleTags.length > 0 ? 'data' : 'empty'}
		open={ddd === null || visibleTags.length > 0}
		sourceLabel="DoesTheDogDie.com"
		sourceHref={dddUrl(ddd?.itemId ?? null)}
		learnHref="/resources#ddd"
	>
		{#if ddd === null}
			<div class="ddd-skeleton" aria-busy="true">
				<div class="skeleton-tag"></div>
				<div class="skeleton-tag"></div>
				<div class="skeleton-tag"></div>
			</div>
		{:else}
			{@render selector?.()}
			{#if visibleTags.length > 0}
				<DddCategoryFilter
					tags={visibleTags}
					{selectedCategory}
					onchange={(cat) => (selectedCategory = cat)}
				/>
				<DddTags tags={filteredTags} />
			{:else}
				<p class="no-data">No trigger tags found for this {mediaNoun}.</p>
			{/if}
		{/if}
	</CollapsibleSection>
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.no-data {
		@apply text-sm text-ink-muted italic;
	}

	.ddd-skeleton {
		@apply flex flex-col gap-sm;
	}

	.skeleton-tag {
		@apply h-9 w-full rounded-md bg-surface animate-pulse;
	}

</style>
