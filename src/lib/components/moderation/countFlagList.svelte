<script lang="ts">
	import { enhance } from '$app/forms';
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ActionOutcome, FlaggedTitle } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		flags: FlaggedTitle['flags'];
		outcome: ActionOutcome;
	}

	let { flags, outcome }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);
	const mine = $derived(flags.some((f) => f.id === outcome?.id) ? outcome : null);
</script>

<ul class="flags" bind:this={root}>
	{#each flags as flag (flag.id)}
		<li>
			<p class="line">
				<span class="label">{flag.reporter ?? 'A removed account'}</span>
				<time class="label" datetime={flag.createdAt}>{formatDate(flag.createdAt)}</time>
				{#if flag.note}<span class="note">{flag.note}</span>{/if}
			</p>
			<div class="actions">
				{#each [{ name: 'resolveFlag', label: 'Resolve', busy: 'Resolving…', style: 'btn--ink' }, { name: 'dismissFlag', label: 'Dismiss', busy: 'Dismissing…', style: 'btn--ghost' }] as action (action.name)}
					<form method="POST" action="?/{action.name}" use:enhance={submit(action.name)}>
						<input type="hidden" name="id" value={flag.id} />
						<button class="btn {action.style}" disabled={busy !== null}>
							{busy === action.name ? action.busy : action.label}
						</button>
					</form>
				{/each}
			</div>
		</li>
	{/each}
</ul>
{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.flags {
		@apply flex flex-col list-none m-0 p-0;
		gap: var(--spacing-sm);
	}

	.line {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.note {
		overflow-wrap: anywhere;
	}

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-xs);
	}
</style>
