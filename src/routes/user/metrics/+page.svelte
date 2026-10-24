<script lang="ts">
	let { data } = $props();

	function metricLabel(metric: string) {
		return (
			{ bechdel: 'Bechdel', unconsenting: 'Unconsenting Media', ddd: 'Does the Dog Die' }[metric] ??
			metric
		);
	}
</script>

<div class="history-page">
	<header class="history-header">
		<a href="/user/profile" class="back-link label">← Profile</a>
		<h1 class="display">Rating history</h1>
	</header>

	{#if data.submissions.length === 0}
		<p class="empty-state label">No ratings yet.</p>
	{:else}
		<ul class="submission-list">
			{#each data.submissions as row (row.submission.id)}
				<li class="submission-row">
					<a href="/movie/{row.submission.movieId}" class="submission-link">
						<span class="movie-title">{row.movieTitle ?? 'Unknown title'}</span>
						<span class="submission-meta label">
							{metricLabel(row.submission.metric)} · {row.submission.value}
						</span>
						<time class="submission-date label" datetime={row.submission.createdAt.toISOString()}>
							{row.submission.createdAt.toLocaleDateString()}
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
