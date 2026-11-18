<script lang="ts">
	import type { OwnCommentEditing } from '#lib/media/utils/ownCommentEditing.svelte.js';
	import CommentComposer from './commentComposer.svelte';

	interface Props {
		editing: OwnCommentEditing;
		/** The comment's text now, which the field starts from. */
		body: string;
		oncancel: () => void;
	}

	let { editing, body, oncancel }: Props = $props();
</script>

<!-- The field the reader's own comment becomes while it is edited (history and profile rows). -->
<CommentComposer
	label="Edit comment"
	submitLabel="Save"
	initial={body}
	busy={editing.busy}
	error={editing.error}
	hint="Saving runs moderation again."
	nested
	autofocus
	onsubmit={(text) => editing.save(text)}
	{oncancel}
/>
