<script lang="ts">
	interface Props {
		comment: string;
	}

	let { comment }: Props = $props();

	// Series notes run to thousands of characters (one line per episode). Long ones open on
	// request so the flags and the sections below stay in view.
	const LONG = 360;
	const isLong = $derived(comment.length > LONG);
	let expanded = $state(false);
	const commentId = $props.id();
</script>

<div class="um-comment">
	<p id={commentId} class="text" class:clamped={isLong && !expanded}>{comment}</p>
	{#if isLong}
		<button
			type="button"
			class="toggle"
			aria-expanded={expanded}
			aria-controls={commentId}
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Show less' : 'Show full notes'}
			<i class="ri-arrow-down-s-line chevron" class:chevron--open={expanded} aria-hidden="true"></i>
		</button>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.um-comment {
		@apply flex flex-col items-start gap-sm;
		padding-left: var(--spacing-md);
		border-left: 1px solid var(--border-strong);
	}

	.text {
		@apply text-ink-muted;
		max-width: 65ch;
		white-space: pre-wrap;
	}

	.clamped {
		@apply line-clamp-4;
	}

	.toggle {
		@apply inline-flex items-center gap-xs text-sm bg-transparent border-0 p-0 cursor-pointer;
		color: var(--brand);
	}

	.toggle:hover {
		@apply underline underline-offset-4;
	}

	.chevron {
		transition: transform 0.15s ease;
	}

	.chevron--open {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
