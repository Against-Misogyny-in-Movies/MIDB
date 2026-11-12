<script lang="ts">
	import CommentItem from './commentItem.svelte';
	import type { Thread } from '#lib/media/utils/commentThread.ts';
	import type { CommentsState } from '#lib/media/utils/commentsState.svelte.js';

	interface Props {
		threads: Thread[];
		state: CommentsState;
	}

	let { threads, state: comments }: Props = $props();
</script>

<ol class="threads">
	{#each threads as thread (thread.root.id)}
		<li class="thread">
			<CommentItem comment={thread.root} state={comments} />
			{#if thread.replies.length > 0}
				<ol class="replies">
					{#each thread.replies as reply (reply.id)}
						<li><CommentItem comment={reply} state={comments} /></li>
					{/each}
				</ol>
			{/if}
		</li>
	{/each}
</ol>

<style lang="postcss">
	@reference "../../../app.css";

	.threads,
	.replies {
		@apply list-none m-0 p-0;
	}

	.thread + .thread {
		border-top: 1px solid var(--border);
	}

	.thread {
		padding-block: var(--spacing-xs);
	}

	/* One rendered reply level, set off by a 1px hairline under the avatar. */
	.replies {
		margin-left: 14px;
		padding-left: var(--spacing-md);
		border-left: 1px solid var(--border);
	}
</style>
