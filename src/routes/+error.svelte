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
	<p class="code display">{$page.status}</p>
	<h1 class="display">{heading}</h1>
	<p class="detail">{detail}</p>
	<a class="btn btn--brand" href="/">Search for a title</a>
</section>

<style lang="postcss">
	@reference "../app.css";

	.error {
		@apply flex flex-col items-center text-center mx-auto;
		max-width: 32rem;
		padding-block: clamp(4rem, 12vw, 7rem);
	}

	.code {
		color: var(--brand);
		font-size: clamp(3.75rem, 16vw, 6rem);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	h1 {
		font-size: 1.875rem;
		line-height: 1.2;
		margin-top: 12px;
	}

	.detail {
		@apply text-ink-muted;
		margin-top: 8px;
		margin-bottom: 32px;
	}
</style>
