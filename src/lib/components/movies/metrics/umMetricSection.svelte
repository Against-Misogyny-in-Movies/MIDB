<script lang="ts">
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import UmCandidates from './umCandidates.svelte';
	import { UM_FLAGS } from '$lib/media/utils/metrics';
	import type { UmCandidate } from '$lib/media/utils/metrics';
	import type { UnconsentingData } from '$lib/server/data/media-queries';

	interface Props {
		umData: UnconsentingData | UmCandidate | null;
		umCandidates: UmCandidate[];
		umFlagCount: number;
		hasUmCandidates: boolean;
		mediaNoun: 'movie' | 'series';
		onselect: (candidate: UmCandidate) => void;
	}

	let { umData, umCandidates, umFlagCount, hasUmCandidates, mediaNoun, onselect }: Props = $props();
</script>

<div id="unconsenting">
	<CollapsibleSection
		title="Unconsenting Media"
		status={umData ? `${umFlagCount} concern${umFlagCount === 1 ? '' : 's'}` : 'No data'}
		tone={umData ? 'data' : 'empty'}
		open={umData !== null || hasUmCandidates}
		sourceLabel={umData ? 'UnconsentingMedia.org' : undefined}
		sourceHref={umData ? `https://www.unconsentingmedia.org/items/${umData.umId}` : undefined}
		learnHref="/resources#unconsenting"
	>
		{#if umData}
			<ul class="um-flags">
				{#each UM_FLAGS as flag (flag.key)}
					{@const value = umData[flag.key] === true}
					{@const reassurance = flag.key === 'noRape' && value}
					{@const present = value && !reassurance}
					<li
						class="um-flag"
						class:um-flag--present={present}
						class:um-flag--reassurance={reassurance}
					>
						<span class="flag-marker" aria-hidden="true">
							<i
								class={reassurance
									? 'ri-check-line'
									: present
										? 'ri-alert-line'
										: 'ri-subtract-line'}
							></i>
						</span>
						<span class="flag-label">{flag.label}</span>
					</li>
				{/each}
			</ul>
			{#if umData.comment}
				<p class="um-comment">{umData.comment}</p>
			{/if}
		{:else if hasUmCandidates}
			<UmCandidates candidates={umCandidates} {onselect} />
		{:else}
			<p class="no-data">This {mediaNoun} is not in the Unconsenting Media database.</p>
		{/if}
	</CollapsibleSection>
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.no-data {
		@apply text-sm text-ink-muted italic;
	}

	.um-flags {
		@apply grid list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 0 var(--spacing-lg);
	}

	/* Row rhythm mirrors the Bechdel criteria ladder */
	.um-flag {
		@apply flex items-center gap-sm text-sm text-ink-muted;
		padding-block: var(--spacing-xs);
	}

	.um-flag--present,
	.um-flag--reassurance {
		@apply text-ink font-medium;
	}

	/* Circular marker shared with the Bechdel criteria ladder */
	.flag-marker {
		@apply flex items-center justify-center rounded-full text-xs shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	/* Absent concerns stay quiet so present ones lead the eye */
	.um-flag:not(.um-flag--present):not(.um-flag--reassurance) .flag-marker {
		background-color: transparent;
		color: color-mix(in oklab, var(--ink-muted) 55%, transparent);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.um-flag--present .flag-marker {
		background-color: color-mix(in oklab, var(--warn) 16%, transparent);
		color: var(--warn);
	}

	.um-flag--reassurance .flag-marker {
		background-color: color-mix(in oklab, var(--success) 16%, transparent);
		color: var(--success);
	}

	.flag-label {
		@apply leading-snug;
	}

	.um-comment {
		@apply text-sm text-ink-muted mt-xs leading-relaxed border-l-2 pl-md;
		border-color: var(--border);
		white-space: pre-wrap;
	}
</style>
