<script lang="ts">
	interface Props {
		/** What the action does and what it loses. */
		message: string;
		confirmLabel: string;
		cancelLabel: string;
		/** The action is running: the confirm button shows it, and its outcome is a toast. */
		busy?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { message, confirmLabel, cancelLabel, busy = false, onconfirm, oncancel }: Props = $props();
</script>

<div class="plate confirm">
	<p class="text-sm">{message}</p>
	<div class="row">
		<button class="btn btn--ink" type="button" aria-busy={busy} onclick={onconfirm}>
			{confirmLabel}
		</button>
		<button class="btn btn--ghost" type="button" onclick={oncancel}>{cancelLabel}</button>
	</div>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.confirm {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.row {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
