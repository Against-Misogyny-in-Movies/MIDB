<script lang="ts">
	import { enhance } from '$app/forms';
	import type { FlaggedTitle } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		flag: FlaggedTitle['flags'][number];
		/** False for a moderator's own flag. */
		canAct: boolean;
	}

	let { flag, canAct }: Props = $props();

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	/** When the last flag closes its card is gone, so the focus goes to the title's heading. */
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		undefined,
		() => 'open-title'
	);
</script>

<li class="flag" tabindex="-1" bind:this={root}>
	<p class="line">
		<span class="label">{flag.reporter ?? 'An account'}</span>
		<time class="label" datetime={flag.createdAt}>{formatDate(flag.createdAt)}</time>
		{#if flag.note}<span class="note">{flag.note}</span>{/if}
	</p>
	{#if canAct}
		<div class="actions">
			{#each [{ name: 'resolveFlag', label: 'Resolve', style: 'btn--ink' }, { name: 'dismissFlag', label: 'Dismiss', style: 'btn--ghost' }] as action (action.name)}
				<form method="POST" action="?/{action.name}" use:enhance={submit(action.name)}>
					<input type="hidden" name="id" value={flag.id} />
					<button
						class="btn {action.style}"
						aria-busy={busy === action.name}
						disabled={busy !== null && busy !== action.name}
					>
						{action.label}
					</button>
				</form>
			{/each}
		</div>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.flag {
		@apply flex flex-col;
		gap: var(--spacing-xs);
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
	}
</style>
