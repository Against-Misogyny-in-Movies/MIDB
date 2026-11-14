<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import type { OwnReport } from '#lib/media/types/profile.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { effectiveStanding, readerStandingLabel } from '#lib/media/utils/reportStanding.ts';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';

	interface Props {
		/** Every community report of the profile's owner, in every status, newest first. */
		reports: OwnReport[];
	}

	let { reports }: Props = $props();
</script>

{#if reports.length === 0}
	<p class="empty">No community reports yet. Reports are added from a film or series page.</p>
{:else}
	<ul class="rows">
		{#each reports as report (`${report.kind}:${report.tmdbId}:${report.title}`)}
			{@const standing = readerStandingLabel(effectiveStanding(report))}
			<li>
				<ProfileTitleLink kind={report.kind} tmdbId={report.tmdbId} name={report.title} />
				<span class="meta">
					<Badge tone={standing.tone}>{standing.label}</Badge>
					<time class="label" datetime={report.updatedAt}
						>Updated {formatDate(report.updatedAt)}</time
					>
				</span>
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.rows {
		@apply flex flex-col list-none p-0 m-0;
	}

	.rows li {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
