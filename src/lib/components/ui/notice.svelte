<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `error` is announced at once (`role="alert"`); `success` and `warn` politely (`role="status"`). */
		tone: 'error' | 'success' | 'warn';
		/** Lets a field name this message in `aria-describedby`. */
		id?: string;
		/** Lets a script move focus to the message (`tabindex="-1"`), when it replaces what had focus. */
		focusable?: boolean;
		children: Snippet;
	}

	let { tone, id, focusable = false, children }: Props = $props();
</script>

<!-- The value is -1 or absent: focus by script only, never in the tab order. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<p
	{id}
	class="notice notice--{tone}"
	role={tone === 'error' ? 'alert' : 'status'}
	tabindex={focusable ? -1 : undefined}
>
	{@render children()}
</p>

<style lang="postcss">
	@reference "../../../app.css";

	.notice {
		@apply text-sm;
		padding: 12px 16px;
		border-radius: 12px;
	}

	.notice:focus-visible {
		outline-offset: 2px;
	}

	.notice--error {
		background-color: var(--danger-soft);
		color: var(--danger);
	}

	.notice--warn {
		background-color: var(--warn-soft);
		color: var(--warn);
	}

	.notice--success {
		background-color: var(--success-soft);
		color: var(--success);
	}
</style>
