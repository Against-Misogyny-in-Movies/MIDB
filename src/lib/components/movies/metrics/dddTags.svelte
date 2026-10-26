<script lang="ts">
	import type { TriggerTag } from '$lib/media/types/ddd';

	interface Props {
		tags: TriggerTag[];
	}

	let { tags }: Props = $props();

	/** yes-share (0–100) used to size the vote bar. */
	function yesPct(yes: number, no: number): number {
		const total = yes + no;
		return total === 0 ? 0 : Math.round((yes / total) * 100);
	}

	// Voter comments open inline under their row, the same with a mouse, a keyboard and on touch.
	let expandedId = $state<number | null>(null);

	function toggle(id: number) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<ul class="ddd-tags">
	<li class="ddd-header" aria-hidden="true">
		<span>Warning</span>
		<span>Category</span>
		<span>Voted yes</span>
		<span class="votes">Yes / No</span>
	</li>
	{#each tags as tag (tag.topicItemId)}
		{@const yes = yesPct(tag.yesSum, tag.noSum)}
		{@const isExpanded = expandedId === tag.topicItemId}
		{@const commentId = `ddd-comment-${tag.topicItemId}`}
		<li class="ddd-tag">
			<div class="row">
				{#if tag.comment}
					<button
						type="button"
						class="tag-name tag-toggle"
						aria-expanded={isExpanded}
						aria-controls={commentId}
						onclick={() => toggle(tag.topicItemId)}
					>
						{tag.doesName}
						<i
							class="ri-chat-3-line comment-icon"
							aria-label={isExpanded ? 'Hide voter comment' : 'Show voter comment'}
						></i>
					</button>
				{:else}
					<span class="tag-name">{tag.doesName}</span>
				{/if}

				<span class="category">{tag.category ?? ''}</span>

				<span class="meter">
					<span class="bar" role="img" aria-label="{yes}% voted yes">
						<span class="bar-yes" style="width: {yes}%"></span>
					</span>
					<span class="pct tabular-nums">{yes}%</span>
				</span>

				<span class="votes tabular-nums">
					{tag.yesSum.toLocaleString()} / {tag.noSum.toLocaleString()}
				</span>
			</div>

			{#if tag.comment && isExpanded}
				<p class="comment" id={commentId}>{tag.comment}</p>
			{/if}
		</li>
	{/each}
</ul>

<style lang="postcss">
	@reference "../../../../app.css";

	.ddd-tags {
		@apply flex flex-col list-none m-0 p-0 text-sm;
	}

	/* Shared column geometry for the header and rows. */
	.ddd-header,
	.row {
		@apply grid items-center gap-md;
		grid-template-columns: minmax(0, 1fr) 9rem minmax(6rem, 11rem) 6rem;
	}

	.ddd-header {
		@apply text-ink-muted border-b border-border;
		padding-block: var(--spacing-sm);
	}

	.ddd-tag {
		@apply border-b border-border;
		padding-block: var(--spacing-sm);
	}

	.tag-name {
		@apply font-medium text-ink;
	}

	.tag-toggle {
		@apply inline-flex items-center gap-sm justify-self-start bg-transparent border-0 p-0 text-left cursor-pointer;
		font: inherit;
	}

	.tag-toggle:hover {
		color: var(--brand);
	}

	.comment-icon {
		@apply text-ink-muted shrink-0;
	}

	.tag-toggle:hover .comment-icon,
	.tag-toggle[aria-expanded='true'] .comment-icon {
		color: var(--brand);
	}

	.category {
		@apply text-ink-muted truncate;
	}

	.meter {
		@apply flex items-center gap-sm min-w-0;
	}

	.bar {
		@apply relative block flex-1 overflow-hidden rounded-full;
		height: 0.375rem;
		background-color: var(--surface-sunken);
	}

	.bar-yes {
		@apply absolute inset-y-0 left-0 rounded-full;
		background-color: var(--ink-muted);
	}

	.pct {
		@apply text-ink-muted text-right shrink-0;
		min-width: 2.5rem;
	}

	.votes {
		@apply text-right whitespace-nowrap text-ink;
	}

	.comment {
		@apply text-ink-muted;
		max-width: 65ch;
		margin-top: var(--spacing-sm);
		padding-left: var(--spacing-md);
		border-left: 1px solid var(--border-strong);
	}

	/* Phones: name and category on their own lines, the meter and votes share the last. */
	@media (max-width: 767px) {
		.ddd-header {
			display: none;
		}

		.row {
			@apply flex flex-wrap gap-x-md gap-y-xs;
		}

		.tag-name,
		.category {
			@apply w-full;
		}

		.tag-toggle {
			@apply justify-between;
		}

		.meter {
			@apply flex-1;
		}
	}
</style>
