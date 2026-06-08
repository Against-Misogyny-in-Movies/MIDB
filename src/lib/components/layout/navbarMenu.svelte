<script lang="ts">
	import { tick } from 'svelte';
	import { nanoid } from 'nanoid';

	// Mobile-only hamburger: collapses the text nav-links + Sign-in into a dropdown
	// surface panel below the md breakpoint. Reuses the collapse-by-default model from
	// navbarSearch (a $state boolean, closed on outside-pointerdown/Escape). The search
	// trigger and theme toggle stay in the bar — they live outside this component.
	let open = $state(false);
	let root = $state<HTMLElement | null>(null);
	let firstLink = $state<HTMLAnchorElement | null>(null);
	const menuId = nanoid();

	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			firstLink?.focus();
		}
	}

	function close() {
		open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) {
			close();
		}
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKeydown} />

<div class="root" bind:this={root}>
	<button
		class="trigger"
		onclick={toggle}
		aria-label="Menu"
		title="Menu"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={menuId}
	>
		<i class={open ? 'ri-close-line' : 'ri-menu-line'} aria-hidden="true"></i>
	</button>

	{#if open}
		<div class="panel" id={menuId} role="menu">
			<a bind:this={firstLink} href="/resources" class="item" role="menuitem" onclick={close}>
				Resources
			</a>
			<a href="/blog" class="item" role="menuitem" onclick={close}>Blog</a>
			<a href="/about" class="item" role="menuitem" onclick={close}>About us</a>
			<a href="/auth" class="item" role="menuitem" onclick={close}>Sign in</a>
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	/* Mobile-only — desktop keeps the inline links, so the whole control hides. */
	.root {
		@apply relative shrink-0;
	}

	@media (min-width: 768px) {
		.root {
			display: none;
		}
	}

	/* Collapsed trigger — borderless icon, matches navbarSearch's trigger and the
	   theme-toggle density. */
	.trigger {
		@apply text-brand bg-transparent border-0 p-0 leading-none;
		@apply hover:text-brand transition-colors cursor-pointer;
		font-size: 1.375rem;
	}

	.trigger:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Dropdown surface — the app's card vocabulary (collapsibleSection border/hover
	   tint) with the soft brand-washed shadow from backToTop. Absolutely positioned
	   so opening causes zero layout shift. */
	.panel {
		@apply absolute right-0 flex flex-col p-xs;
		top: calc(100% + var(--spacing-xs));
		z-index: 50;
		min-width: 11rem;
		@apply rounded-md border border-border bg-surface-raised;
		border-color: color-mix(in oklab, var(--brand) 35%, var(--border));
		box-shadow:
			0 4px 12px color-mix(in oklab, var(--brand) 14%, transparent),
			0 1px 2px color-mix(in oklab, var(--ink) 8%, transparent);
		transform-origin: top right;
		animation: panel-in 0.15s ease;
	}

	.item {
		@apply block no-underline text-ink-muted px-sm py-xs rounded-md;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.item:hover {
		@apply text-brand;
		background-color: color-mix(in oklab, var(--brand) 8%, transparent);
	}

	.item:focus-visible {
		@apply outline-none text-brand;
		box-shadow: inset 0 0 0 2px var(--brand);
	}

	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(-0.25rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
		.item {
			transition: none;
		}
	}
</style>
