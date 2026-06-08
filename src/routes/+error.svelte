<script lang="ts">
	import { page } from '$app/stores';

	// Renders inside the root +layout's <main>, so the navbar/footer chrome stays.
	// 404 gets a bespoke message; other statuses fall back to the framework message.
	const is404 = $derived($page.status === 404);
	const heading = $derived(is404 ? 'Page not found' : 'Something went wrong');
	const glyph = $derived(is404 ? 'ri-compass-3-line' : 'ri-error-warning-line');
	const detail = $derived(
		is404
			? "We couldn't find that title or page — it may have moved, or the link is mistyped."
			: ($page.error?.message ?? 'An unexpected error occurred. Please try again.')
	);
</script>

<svelte:head>
	<title>{$page.status} · {heading} — MIDB</title>
</svelte:head>

<section class="error">
	<span class="badge" aria-hidden="true">
		<i class={glyph}></i>
	</span>
	<p class="code display">{$page.status}</p>
	<h1 class="display">{heading}</h1>
	<p class="detail">{detail}</p>
</section>

<style lang="postcss">
	@reference "../app.css";

	/* Block-centered (not a shrink-to-content flex column): children take the full
     container width and wrap as prose, so lines break naturally instead of
     collapsing word-by-word. Holds the same width at every viewport. */
	.error {
		@apply mx-auto text-center;
		max-width: 30rem;
		padding-block: var(--spacing-xl);
	}

	/* Soft brand-washed badge — the app's color-mix(--brand 16%) marker convention
     (see backToTop), scaled up as a hero affordance. */
	.badge {
		@apply inline-flex items-center justify-center rounded-full;
		width: 4rem;
		height: 4rem;
		font-size: 1.75rem;
		color: var(--brand);
		background-color: color-mix(in oklab, var(--brand) 16%, var(--surface-raised));
		border: 1px solid color-mix(in oklab, var(--brand) 24%, var(--border));
	}

	.code {
		@apply text-brand font-semibold leading-none;
		margin-top: var(--spacing-md);
		font-size: clamp(3.5rem, 18vw, 5rem);
		letter-spacing: 0.02em;
	}

	h1 {
		@apply text-ink font-semibold;
		margin-top: var(--spacing-sm);
		font-size: clamp(1.5rem, 7vw, 2rem);
	}

	.detail {
		@apply text-ink-muted;
		margin-top: var(--spacing-sm);
		margin-inline: auto;
		max-width: 26rem;
		font-size: 1rem;
		line-height: 1.6;
		text-wrap: balance;
	}

	/* Solid primary CTA — matches ui/form/button's brand fill. inline-flex so it
     sizes to its content (gap between icon + label) and stays centered via the
     parent's text-align, instead of stretching to the column width. */
	.home {
		@apply inline-flex items-center gap-xs no-underline cursor-pointer;
		@apply bg-brand text-accent-ink font-bold rounded-md;
		@apply border-2 border-brand;
		margin-top: var(--spacing-lg);
		padding: var(--spacing-sm) var(--spacing-md);
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease;
	}

	.home > i {
		transition: transform 0.15s ease;
	}

	.home:hover {
		@apply bg-brand-strong border-brand-strong;
	}

	.home:hover > i {
		transform: translateX(-2px);
	}

	.home:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.home > i {
			transition: none;
		}
		.home:hover > i {
			transform: none;
		}
	}
</style>
