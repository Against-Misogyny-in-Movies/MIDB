<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `error` is announced at once (`role="alert"`); `success` and `warn` politely (`role="status"`). */
		tone: 'error' | 'success' | 'warn';
		/** Lets a field name this message in `aria-describedby`. */
		id?: string;
		children: Snippet;
	}

	let { tone, id, children }: Props = $props();
</script>

<p {id} class="notice notice--{tone}" role={tone === 'error' ? 'alert' : 'status'}>
	{@render children()}
</p>

<style lang="postcss">
	@reference "../../../app.css";

	.notice {
		@apply text-sm;
		padding: 12px 16px;
		border-radius: 12px;
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
