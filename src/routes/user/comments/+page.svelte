<script lang="ts">
	import { titleHref } from '$lib/media/utils/titleHref';

	let { data } = $props();
</script>

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Comment history</h1>
	</header>

	{#if data.comments.length === 0}
		<p class="empty">No comments yet.</p>
	{:else}
		<ul class="card history">
			{#each data.comments as comment (comment.id)}
				<li>
					<a href={titleHref(comment.kind, comment.tmdbId)}>
						<span class="body">{comment.body}</span>
						<time class="date" datetime={comment.createdAt.toISOString()}>
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

	.history a:hover .body {
		color: var(--brand);
	}

	.body {
		@apply line-clamp-2;
	}

	.date {
		@apply text-sm text-ink-muted;
	}
</style>
