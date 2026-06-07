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

	let { umData, umCandidates, umFlagCount, hasUmCandidates, mediaNoun, onselect }: Props =
		$props();
</script>

<div id="unconsenting">
	<CollapsibleSection
		title="Unconsenting Media"
		status={umData ? `${umFlagCount} concern${umFlagCount === 1 ? '' : 's'}` : 'No data'}
		tone={umData ? 'data' : 'empty'}
		open={umData !== null || hasUmCandidates}
		sourceLabel={umData ? 'UnconsentingMedia.org' : undefined}
		sourceHref={umData ? `https://www.unconsentingmedia.org/items/${umData.umId}` : undefined}
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
						<span class="flag-check" aria-hidden="true">
							<i
								class={reassurance
									? 'ri-checkbox-circle-fill'
									: present
										? 'ri-alert-fill'
										: 'ri-checkbox-blank-circle-line'}
							></i>
						</span>
						<span>{flag.label}</span>
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
		@apply grid gap-xs list-none m-0 p-0;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}

	.um-flag {
		@apply flex items-center gap-sm text-sm text-ink-muted;
	}

	.um-flag--present {
		@apply text-ink font-medium;
	}

	.um-flag--reassurance {
		@apply text-ink font-medium;
	}

	.flag-check {
		@apply flex items-center justify-center w-5 h-5 shrink-0 text-ink-muted opacity-40;
	}

	.um-flag--present .flag-check {
		@apply opacity-100;
		color: var(--warn);
	}

	.um-flag--reassurance .flag-check {
		@apply opacity-100;
		color: var(--success);
	}

	.um-comment {
		@apply text-sm text-ink-muted mt-xs leading-relaxed border-l-2 pl-md;
		border-color: var(--border);
		white-space: pre-wrap;
	}
</style>
