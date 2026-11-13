<script lang="ts">
	import { enhance } from '$app/forms';
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		/** The ids of the selected comments. */
		ids: string[];
		onclear: () => void;
	}

	let { ids, onclear }: Props = $props();

	type Confirm = 'hide' | 'reject';
	let panel = $state<Confirm | null>(null);
	/** The operation whose form is in flight, so its button reads as busy and the others wait. */
	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();

	/** Whatever the outcome, the table reloads, so the selection and the panel close. */
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => {
			panel = null;
			onclear();
		}
	);

	const DIRECT = [
		{ op: 'approve', label: 'Approve' },
		{ op: 'restore', label: 'Restore' },
		{ op: 'dismiss', label: 'Dismiss reports' }
	];
</script>

<div class="card bar" role="region" aria-label="Actions for the selected comments" bind:this={root}>
	<div class="head">
		<p>
			<span class="num count">{ids.length}</span>
			selected
		</p>
		<form
			class="ops"
			method="POST"
			action="?/bulk"
			use:enhance={({ submitter }) =>
				submit((submitter as HTMLButtonElement | null)?.value ?? 'bulk')()}
		>
			{#each ids as id (id)}
				<input type="hidden" name="ids" value={id} />
			{/each}
			{#each DIRECT as { op, label } (op)}
				<button
					class="btn btn--ink"
					name="op"
					value={op}
					aria-busy={busy === op}
					disabled={busy !== null && busy !== op}
				>
					{label}
				</button>
			{/each}
		</form>
		<div class="ops">
			<button
				class="btn btn--ghost"
				type="button"
				aria-expanded={panel === 'hide'}
				onclick={() => (panel = panel === 'hide' ? null : 'hide')}>Hide</button
			>
			<button
				class="btn btn--ghost"
				type="button"
				aria-expanded={panel === 'reject'}
				onclick={() => (panel = panel === 'reject' ? null : 'reject')}>Reject</button
			>
			<button class="btn btn--ghost" type="button" onclick={onclear}>Clear selection</button>
		</div>
	</div>
	{#if panel}
		<ModerationConfirm
			kind={panel}
			name=""
			fields={{ op: panel, ids }}
			action="bulk"
			count={ids.length}
			{busy}
			{submit}
			oncancel={() => (panel = null)}
		/>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.bar {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		position: sticky;
		bottom: var(--spacing-md);
		z-index: 2;
		box-shadow: var(--shadow-float);
	}

	.head {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-sm) var(--spacing-md);
	}

	.count {
		@apply font-semibold;
	}

	.ops {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
