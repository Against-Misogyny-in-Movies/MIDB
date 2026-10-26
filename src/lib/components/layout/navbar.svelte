<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
	import Avatar from '$lib/components/user/avatars/Avatar.svelte';
	import { session } from '$lib/media/utils/session.svelte.js';
	import NavbarSearch from './navbarSearch.svelte';
	import NavbarMenu from './navbarMenu.svelte';

	// The navbar lives in the root layout, so this runs once per full page load.
	onMount(() => {
		session.load();
	});

	const showSearch = $derived($page.url.pathname !== '/');
	const canModerate = $derived(
		session.user?.role === 'moderator' || session.user?.role === 'administrator'
	);
</script>

<nav>
	<a href="/" class="display wordmark">MIDB</a>
	<div class="actions">
		{#if showSearch}
			<NavbarSearch />
		{/if}
		<a href="/resources" class="nav-link wide-only">How it works</a>
		<ThemeToggle />
		<!-- SSR is user-agnostic (CDN-cached), so this slot renders empty and resolves on the
		     client. Its fixed size means every state fits without moving its siblings. -->
		<div class="auth-slot" aria-busy={session.status === 'pending'}>
			{#if session.status === 'user' && session.user}
				{#if canModerate}
					<a
						href="/user/moderation"
						class="icon-link wide-only"
						aria-label="Moderation"
						title="Moderation"
					>
						<i class="ri-shield-user-line" aria-hidden="true"></i>
					</a>
				{/if}
				<a href="/user/profile" class="user-link">
					<Avatar avatarKey={session.user.avatarKey} size={24} />
					<span class="username">{session.user.displayName}</span>
				</a>
			{:else if session.status === 'anon' || session.hint === 'anon'}
				<a href="/auth" class="nav-link">Sign in</a>
			{:else if session.hint === 'user'}
				<span class="avatar-placeholder" aria-hidden="true"></span>
			{/if}
		</div>
		<NavbarMenu />
	</div>
</nav>

<style lang="postcss">
	@reference "../../../app.css";

	nav {
		@apply flex items-center justify-between gap-md max-w-5xl mx-auto px-md;
		height: 3.5rem;
	}

	.wordmark {
		@apply text-2xl text-ink no-underline shrink-0;
		font-weight: 800;
		letter-spacing: 0;
	}

	.actions {
		@apply flex items-center gap-md min-w-0;
	}

	.nav-link {
		@apply text-sm text-ink-muted no-underline shrink-0 whitespace-nowrap;
		transition: color 0.15s ease;
	}

	.nav-link:hover {
		@apply text-ink;
	}

	/* Reserved auth slot at the right edge: one fixed box for pending, signed-out and
	   signed-in, so the client-side session resolving never shifts the bar. The username
	   truncates to fit. Signing out lives on the profile page and in the mobile menu. */
	.auth-slot {
		@apply flex items-center justify-end gap-md shrink-0 overflow-hidden;
		width: 8rem;
		height: 1.75rem;
	}

	.user-link {
		@apply flex items-center gap-sm no-underline text-sm text-ink-muted min-w-0;
		transition: color 0.15s ease;
	}

	.user-link:hover {
		@apply text-ink;
	}

	.user-link :global(svg) {
		@apply shrink-0;
	}

	.username {
		@apply truncate;
	}

	.icon-link {
		@apply flex shrink-0 text-ink-muted no-underline leading-none text-lg;
	}

	.icon-link:hover {
		@apply text-ink;
	}

	.avatar-placeholder {
		@apply block shrink-0 rounded-full;
		width: 1.5rem;
		height: 1.5rem;
		background-color: var(--secondary-soft);
	}

	/* Below md the menu carries these links. */
	@media (max-width: 767px) {
		.wide-only {
			display: none;
		}

		/* Fits "Sign in" or the avatar alone. */
		.auth-slot {
			width: 3.25rem;
		}

		.username {
			display: none;
		}
	}
</style>
