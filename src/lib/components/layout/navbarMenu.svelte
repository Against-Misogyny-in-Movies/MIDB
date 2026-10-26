<script lang="ts">
	import { tick } from 'svelte';
	import LogoutButton from '$lib/components/auth/logoutButton.svelte';
	import { session } from '$lib/media/utils/session.svelte.js';

	// Below md the bar keeps only search, the account slot and the theme toggle; this menu
	// carries the rest. Closes on outside pointerdown and Escape. Account links read the client
	// session (the navbar starts it); the Moderation link is a convenience only, authorization
	// stays server-side.
	const canModerate = $derived(
		session.user?.role === 'moderator' || session.user?.role === 'administrator'
	);

	let open = $state(false);
	let root = $state<HTMLElement | null>(null);
	let firstLink = $state<HTMLAnchorElement | null>(null);
	const menuId = $props.id();

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
				Methodology
			</a>
			{#if canModerate}
				<a href="/user/moderation" class="item" role="menuitem" onclick={close}>Moderation</a>
			{/if}
			{#if session.likelyUser}
				<a href="/user/profile" class="item" role="menuitem" onclick={close}>Profile</a>
				{#if session.status === 'user'}
					<LogoutButton variant="menu" />
				{/if}
			{:else}
				<a href="/auth" class="item" role="menuitem" onclick={close}>Sign in</a>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.root {
		@apply relative shrink-0;
	}

	@media (min-width: 768px) {
		.root {
			display: none;
		}
	}

	.trigger {
		@apply flex text-ink-muted bg-transparent border-0 p-0 leading-none cursor-pointer text-xl;
		transition: color 0.15s ease;
	}

	.trigger:hover {
		@apply text-ink;
	}

	/* Absolutely positioned, so opening causes no layout shift. */
	.panel {
		@apply absolute right-0 flex flex-col py-xs border border-border bg-surface-raised;
		border-radius: 12px;
		top: calc(100% + var(--spacing-sm));
		z-index: 50;
		min-width: 11rem;
		box-shadow: var(--shadow-md);
	}

	.item {
		@apply block no-underline text-sm font-medium text-ink px-md py-sm;
	}

	.item:hover {
		background-color: var(--surface-sunken);
	}

	.item:focus-visible {
		outline-offset: -2px;
	}
</style>
