<script lang="ts">
	import Notice from '#lib/components/ui/notice.svelte';

	interface Props {
		/** What the action does and what it loses. */
		message: string;
		confirmLabel: string;
		busyLabel: string;
		cancelLabel: string;
		busy?: boolean;
		error?: string;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let {
		message,
		confirmLabel,
		busyLabel,
		cancelLabel,
		busy = false,
		error,
		onconfirm,
		oncancel
	}: Props = $props();
</script>

<div class="confirm">
	<p class="text-sm">{message}</p>
	<div class="row">
		<button class="btn btn--ink" type="button" disabled={busy} onclick={onconfirm}>
			{busy ? busyLabel : confirmLabel}
		</button>
		<button class="btn btn--ghost" type="button" onclick={oncancel}>{cancelLabel}</button>
	</div>
	{#if error}<Notice tone="error">{error}</Notice>{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	/* A plate under the comment it acts on, like the confirmations on the sign-in methods page. */
	.confirm {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border-radius: 12px;
		background-color: var(--surface-sunken);
	}

	.row {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
