<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<!-- Hanko's element renders its own heading and form; this only places it. -->
<div class="auth">
	{@render children()}
</div>

<style lang="postcss">
	@reference "../../app.css";

	.auth {
		@apply mx-auto;
		max-width: 26rem;
		padding-block: var(--spacing-xl);
	}
</style>
