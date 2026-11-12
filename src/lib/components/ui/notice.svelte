<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `error` is announced at once (`role="alert"`); `success` politely (`role="status"`). */
		tone: 'error' | 'success';
		children: Snippet;
	}

	let { tone, children }: Props = $props();
</script>

<p class="notice notice--{tone}" role={tone === 'error' ? 'alert' : 'status'}>
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

	.notice--success {
		background-color: var(--success-soft);
		color: var(--success);
	}
</style>
