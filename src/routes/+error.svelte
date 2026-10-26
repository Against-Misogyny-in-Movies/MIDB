<script lang="ts">
	import { page } from '$app/stores';

	// Renders inside the root +layout's <main>, so the navbar/footer chrome stays.
	// 404 gets a bespoke message; other statuses fall back to the framework message.
	const is404 = $derived($page.status === 404);
	const heading = $derived(is404 ? 'Page not found' : 'Something went wrong');
	const detail = $derived(
		is404
			? 'No title or page at this address.'
			: ($page.error?.message ?? 'The page could not be loaded. Try again.')
	);
</script>

<svelte:head>
	<title>{$page.status} · {heading} · MIDB</title>
</svelte:head>

<section class="error">
	<p class="code display tabular-nums">{$page.status}</p>
	<h1 class="display">{heading}</h1>
	<p class="detail">{detail}</p>
	<p class="actions"><a class="link" href="/">Search for a title</a></p>
</section>

<style lang="postcss">
	@reference "../app.css";

	.error {
		max-width: 32rem;
		padding-block: clamp(3rem, 10vw, 6rem);
	}

	.code {
		@apply text-ink-muted;
		font-size: clamp(4rem, 18vw, 6rem);
		font-weight: 800;
		line-height: 1;
	}

	h1 {
		@apply text-3xl;
		margin-top: var(--spacing-sm);
	}

	.detail {
		@apply text-ink-muted;
		margin-top: var(--spacing-sm);
	}

	.actions {
		margin-top: var(--spacing-lg);
	}
</style>
