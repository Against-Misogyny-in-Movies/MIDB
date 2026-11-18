<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentHistoryRow from '#lib/components/comments/commentHistoryRow.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { OwnProfile } from '#lib/media/types/profile.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { effectiveStanding, readerStandingLabel } from '#lib/media/utils/reportStanding.ts';

	interface Props {
		/** What the owner has that the public lists leave out (`OwnProfile`). */
		items: OwnProfile['notPublic'];
	}

	let { items }: Props = $props();
</script>

{#if items.comments.length > 0}
	<h2 class="label group">Comments</h2>
	<ul class="rows">
		{#each items.comments as comment (comment.id)}
			<CommentHistoryRow {comment} />
		{/each}
	</ul>
{/if}
{#if items.reports.length > 0}
	<h2 class="label group">Community reports</h2>
	<ul class="rows">
		{#each items.reports as report (report.titleId)}
			{@const standing = readerStandingLabel(effectiveStanding(report))}
			<li>
				<span class="title-line">
					<ProfileTitleLink kind={report.kind} tmdbId={report.tmdbId} name={report.title} />
				</span>
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

	.group {
		padding: var(--spacing-md) 20px var(--spacing-xs);
		border-top: 1px solid var(--border);
	}

	.rows {
		@apply flex flex-col list-none p-0 m-0;
	}

	.rows > :global(li) {
		border-top: 1px solid var(--border);
	}

	.rows > li {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
	}

	/* The title is the size a comment row gives it. */
	.title-line {
		@apply text-sm;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}
</style>
