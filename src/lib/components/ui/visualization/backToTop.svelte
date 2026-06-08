<script lang="ts">
	// Mobile-only affordance for the long detail pages: once the user has scrolled
	// past the fold, a fixed button fades in to jump back to the top. Desktop hides
	// it entirely (the pages are short enough there and the chrome stays in reach).
	//
	// window.scrollY isn't a reactive source, so there's nothing to $derive — a
	// guarded onscroll handler that only assigns on a real flip is the cheapest
	// zero-layout-shift option (the button is always rendered; only opacity toggles).
	let visible = $state(false);

	function onScroll() {
		const next = window.scrollY > 360;
		if (next !== visible) visible = next;
	}

	function toTop() {
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
	}
</script>

<svelte:window onscroll={onScroll} />

<button
	class="back-to-top"
	class:is-visible={visible}
	onclick={toTop}
	aria-label="Back to top"
	title="Back to top"
	tabindex={visible ? 0 : -1}
>
	<i class="ri-arrow-up-line" aria-hidden="true"></i>
</button>

<style lang="postcss">
	@reference "../../../../app.css";

	.back-to-top {
		@apply fixed flex items-center justify-center cursor-pointer;
		@apply rounded-full;
		bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom, 0px));
		right: calc(var(--spacing-md) + env(safe-area-inset-right, 0px));
		z-index: 50;
		width: 3rem;
		height: 3rem;
		font-size: 1.375rem;
		line-height: 1;
		background-color: color-mix(in oklab, var(--brand) 16%, var(--surface-raised));
		color: var(--brand);
		border: 1px solid color-mix(in oklab, var(--brand) 24%, var(--border));
		box-shadow:
			0 4px 12px color-mix(in oklab, var(--brand) 14%, transparent),
			0 1px 2px color-mix(in oklab, var(--ink) 8%, transparent);
		opacity: 0;
		transform: translateY(0.5rem) scale(0.92);
		pointer-events: none;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease,
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.back-to-top.is-visible {
		opacity: 1;
		transform: translateY(0) scale(1);
		pointer-events: auto;
	}

	.back-to-top:hover {
		background-color: color-mix(in oklab, var(--brand) 24%, var(--surface-raised));
		box-shadow:
			0 6px 16px color-mix(in oklab, var(--brand) 20%, transparent),
			0 1px 2px color-mix(in oklab, var(--ink) 10%, transparent);
	}

	/* Press feedback — settle toward the page without losing the visible offset. */
	.back-to-top.is-visible:active {
		transform: translateY(1px) scale(0.96);
	}

	.back-to-top > i {
		@apply block;
		transition: transform 0.15s ease;
	}

	.back-to-top:hover > i {
		transform: translateY(-1px);
	}

	.back-to-top:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Desktop has short pages and persistent chrome — no need for the affordance. */
	@media (min-width: 768px) {
		.back-to-top {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.back-to-top {
			transition: opacity 0.15s ease;
			transform: none;
		}
		.back-to-top.is-visible {
			transform: none;
		}
		.back-to-top.is-visible:active,
		.back-to-top:hover > i {
			transform: none;
		}
		.back-to-top > i {
			transition: none;
		}
	}
</style>
