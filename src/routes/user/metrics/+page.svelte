<script lang="ts">
	import type { PageData } from './$types';
	import { titleHref } from '#lib/media/utils/titleHref.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { reportStanding } from '#lib/media/utils/reportStanding.ts';
	import Badge from '#lib/components/ui/badge.svelte';

	let { data }: { data: PageData } = $props();
</script>

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Reader reports</h1>
	</header>

	{#if data.ratings.length === 0}
		<p class="empty">No reader reports yet.</p>
	{:else}
		<ul class="card history">
			{#each data.ratings as row (row.titleId)}
				{@const standing = reportStanding(row, { restricted: row.restricted })}
				<li>
					<a href={titleHref(row.kind, row.tmdbId)}>
						<span class="title">{row.title}</span>
						<span class="meta">
							<Badge tone={standing.tone}>{standing.label}</Badge>
							<time datetime={row.updatedAt.toISOString()}
								>Updated {formatDate(row.updatedAt.toISOString())}</time
							>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.account-page {
		@apply flex flex-col mx-auto;
		max-width: 36rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
		margin-bottom: var(--spacing-sm);
	}

	.back:hover {
		@apply text-ink;
	}

	h1 {
		font-size: 1.875rem;
	}

	.empty {
		@apply text-ink-muted;
	}

	.history {
		@apply flex flex-col list-none p-0 m-0 overflow-hidden;
	}

	.history li + li {
		border-top: 1px solid var(--border);
	}

	.history a {
		@apply flex flex-col gap-xs no-underline text-ink;
		padding: 14px 20px;
	}

	.history a:hover .title {
		color: var(--brand);
	}

	.title {
		@apply font-medium;
	}

	.meta {
		@apply flex flex-wrap items-center gap-sm text-sm text-ink-muted;
	}
</style>
