<script lang="ts">
	import { navigating } from '$app/stores';

	// Global navigation progress bar. SvelteKit navigation is blocking — the old
	// page stays on screen while a route's `load` runs (TMDB + DB on the details
	// page), with no feedback. This pins a thin brand bar to the viewport top
	// whenever a navigation is in flight, covering every source (nav links,
	// search, browser back/forward) from one place.
	//
	// The bar eases toward ~90% while loading (it can't know real progress), then
	// snaps to 100% and fades out once `$navigating` clears — the familiar
	// top-loader feel. Fixed-position + opacity only, so it never shifts layout.
	let active = $derived($navigating !== null);

	// Drive width off `active`: 90% while navigating, 100% on settle. Width is the
	// only animated property; the CSS transition does the easing.
	let width = $state(0);
	let visible = $state(false);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		clearTimeout(hideTimer);
		if (active) {
			visible = true;
			// Next frame so the transition runs from the reset 0 width.
			width = 0;
			requestAnimationFrame(() => {
				width = 90;
			});
		} else if (visible) {
			width = 100;
			hideTimer = setTimeout(() => {
				visible = false;
				width = 0;
			}, 200);
		}
		return () => clearTimeout(hideTimer);
	});
</script>

{#if visible}
	<div
		class="nav-progress"
		style:width="{width}%"
		role="progressbar"
		aria-label="Loading page"
		aria-busy="true"
	></div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.nav-progress {
		@apply fixed top-0 left-0;
		height: 3px;
		z-index: 100;
		background-color: var(--brand);
		box-shadow: 0 0 8px color-mix(in oklab, var(--brand) 60%, transparent);
		/* Width eases toward the loading plateau / completion; opacity isn't
		   animated here — the bar is removed from the DOM after the settle. */
		transition: width 0.3s ease;
		will-change: width;
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-progress {
			transition: none;
		}
	}
</style>
