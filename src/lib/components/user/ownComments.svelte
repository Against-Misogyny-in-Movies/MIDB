<script lang="ts">
	import CommentHistoryRow from '#lib/components/comments/commentHistoryRow.svelte';
	import type { UserCommentRow } from '#lib/media/types/comments.ts';

	interface Props {
		/** Every comment of the profile's owner, in every status, newest first. */
		comments: UserCommentRow[];
	}

	let { comments }: Props = $props();
</script>

{#if comments.length === 0}
	<p class="empty">No comments yet. Comments are written on a film or series page.</p>
{:else}
	<ul class="rows">
		{#each comments as comment (comment.id)}
			<CommentHistoryRow {comment} />
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.rows {
		@apply flex flex-col list-none p-0 m-0;
	}

	.rows > :global(li) {
		border-top: 1px solid var(--border);
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
