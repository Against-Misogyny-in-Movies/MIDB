<script lang="ts">
	import type { OwnCommentEditing } from '#lib/media/utils/ownCommentEditing.svelte.js';
	import CommentConfirm from './commentConfirm.svelte';

	interface Props {
		editing: OwnCommentEditing;
		/** The comment's published replies, which stay under a placeholder. */
		replyCount: number;
		oncancel: () => void;
	}

	let { editing, replyCount, oncancel }: Props = $props();

	const message = $derived(
		`Delete this comment? Other readers no longer see its text. It stays here, marked as deleted.${
			replyCount > 0 ? ' Replies stay under a placeholder.' : ''
		}`
	);
</script>

<!-- The confirmation of deleting the reader's own comment (history and profile rows). -->
<CommentConfirm
	{message}
	confirmLabel="Delete comment"
	cancelLabel="Keep comment"
	busy={editing.busy}
	onconfirm={() => editing.remove()}
	{oncancel}
/>
