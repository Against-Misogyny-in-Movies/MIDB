<script lang="ts">
	import { enhance } from '$app/forms';
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import type { AccountNote } from '#lib/media/types/moderation.ts';
	import { NOTE_MAX } from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		userId: string;
		notes: AccountNote[];
		/** How many notes the account has; the list shows the newest. */
		total: number;
		/** Whether the acting staff member may add a note (`canActOn`). */
		canAdd: boolean;
	}

	let { userId, notes, total, canAdd }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	let body = $state('');
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

	/** The note stays in the field when the server refuses it, and clears once it is saved. */
	const addNote = () => {
		const run = submit('note')();
		return async (event: Parameters<typeof run>[0]) => {
			await run(event);
			if (event.result.type === 'success') body = '';
		};
	};
</script>

<section class="card notes" aria-labelledby="notes-heading" bind:this={root} tabindex="-1">
	<h2 id="notes-heading">Staff notes</h2>
	{#if notes.length === 0}
		<p class="label">No notes yet.</p>
	{:else}
		<ul class="list">
			{#each notes as note (note.id)}
				<li>
					<p class="head label">
						<time datetime={note.createdAt}>{formatDate(note.createdAt)}</time>
						<AccountLink
							id={note.authorId}
							username={note.author}
							name={note.author ?? 'A removed account'}
						/>
					</p>
					<p class="body">{note.body}</p>
				</li>
			{/each}
		</ul>
		{#if total > notes.length}
			<p class="label">Showing the newest {notes.length} of {total} notes.</p>
		{/if}
	{/if}

	{#if canAdd}
		<form method="POST" action="?/note" use:enhance={addNote}>
			<input type="hidden" name="userId" value={userId} />
			<label class="field">
				<span class="label">Add a note. Only staff see it.</span>
				<textarea class="input" name="body" rows="3" maxlength={NOTE_MAX} required bind:value={body}
				></textarea>
			</label>
			<div class="action-row">
				<button
					class="btn btn--ink"
					aria-busy={busy === 'note'}
					disabled={body.trim() === '' || (busy !== null && busy !== 'note')}>Add note</button
				>
			</div>
		</form>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.notes {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: var(--spacing-md) 20px;
	}

	h2 {
		@apply text-lg font-semibold;
	}

	.list {
		@apply flex flex-col list-none m-0 p-0;
	}

	.list li {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding-block: var(--spacing-sm);
		border-top: 1px solid var(--border);
	}

	.head {
		@apply flex flex-wrap;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.body {
		@apply text-sm;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	form {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	textarea.input {
		@apply h-auto;
		min-height: 5.5rem;
		padding-block: var(--spacing-sm);
		resize: vertical;
	}
</style>
