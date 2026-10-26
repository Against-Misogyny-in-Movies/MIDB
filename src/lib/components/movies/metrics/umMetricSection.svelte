<script lang="ts">
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import UmCandidates from './umCandidates.svelte';
	import UmComment from './umComment.svelte';
	import { UM_FLAGS } from '$lib/media/utils/metrics';
	import type { UmEntry } from '$lib/media/types/um';

	interface Props {
		umData: UmEntry | null;
		umCandidates: UmEntry[];
		umFlagCount: number;
		hasUmCandidates: boolean;
		mediaNoun: 'movie' | 'series';
		onselect: (candidate: UmEntry) => void;
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
				{#key umData.umId}
					<UmComment comment={umData.comment} />
				{/key}
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
		@apply text-ink-muted;
	}

	.um-flags {
		@apply grid list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0 var(--spacing-lg);
	}

	/* Shared marker pattern: see .CLAUDE/architecture.md. */
	.um-flag {
		@apply flex items-center gap-sm text-sm text-ink-muted;
		padding-block: var(--spacing-xs);
	}

	.um-flag--present,
	.um-flag--reassurance {
		@apply text-ink font-medium;
	}

	.flag-marker {
		@apply flex items-center justify-center rounded-full text-xs shrink-0;
		width: 1.375rem;
		height: 1.375rem;
		color: var(--ink-muted);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.um-flag--present .flag-marker {
		background-color: var(--warn-soft);
		color: var(--warn);
		box-shadow: none;
	}

	.um-flag--reassurance .flag-marker {
		background-color: var(--success-soft);
		color: var(--success);
		box-shadow: none;
	}

	.flag-label {
		@apply leading-snug;
	}
</style>
