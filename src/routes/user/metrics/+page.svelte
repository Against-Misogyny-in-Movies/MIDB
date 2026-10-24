<script lang="ts">
	import type { PageData } from './$types';
	import { titleHref } from '$lib/media/utils/titleHref';

	let { data }: { data: PageData } = $props();

	function ratingLabel(row: PageData['ratings'][number]) {
		return row.metric === 'bechdel'
			? `Bechdel · ${row.value}/3`
			: `Unconsenting Media · ${row.value} concern${row.value === 1 ? '' : 's'}`;
	}
</script>

<div class="history-page">
	<header class="history-header">
		<a href="/user/profile" class="back-link label">← Profile</a>
		<h1 class="display">Rating history</h1>
	</header>

	{#if data.ratings.length === 0}
		<p class="empty-state label">No ratings yet.</p>
	{:else}
		<ul class="submission-list">
			{#each data.ratings as row (`${row.metric}:${row.titleId}`)}
				<li class="submission-row">
					<a href={titleHref(row.kind, row.tmdbId)} class="submission-link">
						<span class="movie-title">{row.title}</span>
						<span class="submission-meta label">{ratingLabel(row)}</span>
						<time class="submission-date label" datetime={row.updatedAt.toISOString()}>
							{row.updatedAt.toLocaleDateString()}
						</time>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.history-page {
		@apply max-w-lg mx-auto py-lg flex flex-col gap-lg;
	}

	.history-header {
		@apply flex flex-col gap-sm;
	}

	.back-link {
		@apply text-ink-muted no-underline text-sm hover:text-brand;
	}

	.empty-state {
		@apply text-ink-muted;
	}

	.submission-list {
		@apply flex flex-col gap-sm list-none p-0 m-0;
	}

	.submission-row {
		@apply border border-border rounded-lg;
	}

	.submission-link {
		@apply flex flex-col gap-xs p-md no-underline text-ink hover:bg-surface-raised rounded-lg;
	}

	.movie-title {
		@apply text-sm font-medium;
	}

	.submission-meta {
		@apply text-sm text-ink-muted;
	}

	.submission-date {
		@apply text-xs text-ink-muted;
	}
</style>
