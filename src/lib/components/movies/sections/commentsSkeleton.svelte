<section id="comments" class="comments-section">
	<h2 class="comments-heading display">Comments</h2>
	<div class="comments-list" aria-busy="true" aria-label="Loading comments">
		{#each { length: 4 } as _, i (i)}
			<div class="comment-skeleton">
				<div class="comment-skeleton__avatar"></div>
				<div class="comment-skeleton__body">
					<div class="comment-skeleton__meta">
						<div class="comment-skeleton__name"></div>
						<div class="comment-skeleton__date"></div>
					</div>
					<div class="comment-skeleton__line"></div>
					<div class="comment-skeleton__line comment-skeleton__line--short"></div>
				</div>
			</div>
		{/each}
	</div>
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.comments-section {
		@apply flex flex-col gap-lg;
	}

	.comments-heading {
		@apply text-xl font-semibold text-ink;
	}

	.comments-list {
		@apply flex flex-col gap-md;
	}

	.comment-skeleton {
		@apply flex gap-md;
	}

	.comment-skeleton__avatar {
		@apply w-10 h-10 rounded-full shrink-0 animate-pulse;
		background-color: var(--surface-raised);
	}

	.comment-skeleton__body {
		@apply flex flex-col gap-xs flex-1 min-w-0;
	}

	.comment-skeleton__meta {
		@apply flex items-center gap-sm;
	}

	.comment-skeleton__name {
		@apply h-3 w-24 rounded animate-pulse;
		background-color: var(--surface-raised);
	}

	.comment-skeleton__date {
		@apply h-3 w-16 rounded animate-pulse;
		background-color: var(--surface-raised);
		animation-delay: 80ms;
	}

	.comment-skeleton__line {
		@apply h-3 w-full rounded animate-pulse;
		background-color: var(--surface-raised);
		animation-delay: 120ms;
	}

	.comment-skeleton__line--short {
		@apply w-3/5;
		animation-delay: 160ms;
	}
</style>
