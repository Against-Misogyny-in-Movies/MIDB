<script lang="ts">
	import { titleHref } from '$lib/media/utils/titleHref';

	let { data } = $props();
</script>

<div class="history-page">
	<header class="history-header">
		<a href="/user/profile" class="back-link label">← Profile</a>
		<h1 class="display">Comment history</h1>
	</header>

	{#if data.comments.length === 0}
		<p class="empty-state label">No comments yet.</p>
	{:else}
		<ul class="comment-list">
			{#each data.comments as comment (comment.id)}
				<li class="comment-row">
					<a href={titleHref(comment.kind, comment.tmdbId)} class="comment-link">
						<span class="comment-body">{comment.body}</span>
						<time class="comment-date label" datetime={comment.createdAt.toISOString()}>
							{comment.createdAt.toLocaleDateString()}
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

	.comment-list {
		@apply flex flex-col gap-sm list-none p-0 m-0;
	}

	.comment-row {
		@apply border border-border rounded-lg;
	}

	.comment-link {
		@apply flex flex-col gap-xs p-md no-underline text-ink hover:bg-surface-raised rounded-lg;
	}

	.comment-body {
		@apply text-sm line-clamp-2;
	}

	.comment-date {
		@apply text-xs text-ink-muted;
	}
</style>
