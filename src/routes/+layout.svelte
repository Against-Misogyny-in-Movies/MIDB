<script lang="ts">
	import type { Snippet } from 'svelte';
	import 'remixicon/fonts/remixicon.css';
	import '../app.css';
	import Navbar from '#lib/components/layout/navbar.svelte';
	import Footer from '#lib/components/layout/footer.svelte';
	import NavProgress from '#lib/components/layout/navProgress.svelte';
	import Toaster from '#lib/components/layout/toaster.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	/**
	 * A button whose action is running (`.btn[aria-busy='true']`) stays enabled so it keeps the
	 * keyboard focus, and this ignores a second press of it, a form's submit included.
	 */
	function holdBusyButtons(event: MouseEvent) {
		if (!(event.target instanceof Element)) return;
		if (!event.target.closest(".btn[aria-busy='true']")) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	}
</script>

<svelte:document onclickcapture={holdBusyButtons} />

<NavProgress />

<div class="shell">
	<header>
		<Navbar />
	</header>

	<main>
		{@render children()}
	</main>

	<Footer />
</div>

<Toaster />

<style lang="postcss">
	@reference "../app.css";

	.shell {
		@apply flex flex-col min-h-screen;
	}

	/* Sticky bar: the page scrolls under it. Anchored sections use scroll-margin-top: 5rem. */
	header {
		@apply sticky top-0 border-b border-border;
		z-index: 40;
		background-color: var(--surface-raised);
		box-shadow: var(--shadow-subtle);
	}

	main {
		@apply flex-1 max-w-5xl w-full mx-auto px-md;
	}
</style>
