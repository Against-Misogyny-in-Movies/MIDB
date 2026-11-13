<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import type { CommunityReportsState } from '#lib/media/utils/communityReportsState.svelte.js';

	interface Props {
		/** The title's reports, loaded by the section; the badge only reads them. */
		reports: CommunityReportsState;
	}

	let { reports }: Props = $props();

	const loading = $derived(reports.phase === 'loading');
	const total = $derived(reports.counts?.total ?? 0);
	const label = $derived(total === 1 && !loading ? 'community report' : 'community reports');
</script>

<a class="link-badge" href="#community-reports">
	<Badge tone="neutral" busy={loading}>
		{#if reports.phase === 'error'}
			MIDB community reports
		{:else}
			<!-- While loading the number is a hidden digit that holds its slot. -->
			<span class="num" class:pending={loading}>{loading ? '0' : total}</span>
			{label}
		{/if}
	</Badge>
</a>

<style lang="postcss">
	@reference "../../../../app.css";

	.link-badge {
		@apply inline-flex items-center self-start;
		border-radius: 9999px;
	}

	.link-badge:hover :global(.badge) {
		color: var(--ink);
	}

	.num {
		@apply inline-block text-center;
		min-width: 1ch;
	}

	.pending {
		visibility: hidden;
	}

	@media (pointer: coarse) {
		.link-badge {
			min-height: 2.75rem;
		}
	}
</style>
