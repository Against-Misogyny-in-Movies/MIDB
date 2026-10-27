<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<!-- Hanko's element renders its own heading and form; this only places it. -->
<div class="card auth">
	{@render children()}
</div>

<style lang="postcss">
	@reference "../../app.css";

	.auth {
		@apply mx-auto;
		max-width: 28rem;
		margin-block: clamp(2.5rem, 8vw, 4rem);
		padding: 32px;
		box-shadow: var(--shadow-float);
	}

	@media (max-width: 479px) {
		.auth {
			padding: 24px 20px;
		}
	}
</style>
