<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
	import Avatar from '$lib/components/user/avatars/Avatar.svelte';
	import LogoutButton from '$lib/components/auth/logoutButton.svelte';
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
		<div class="links">
			<a href="/resources" class="label nav-link">Resources</a>
			<a href="/blog" class="label nav-link">Blog</a>
			<a href="/about" class="label nav-link">About us</a>
		</div>
		<!-- SSR is user-agnostic (CDN-cached), so this slot renders empty and resolves on the
		     client. Its fixed size means every state fits without moving its siblings. -->
		<div class="auth-slot" aria-busy={session.status === 'pending'}>
			{#if session.status === 'user' && session.user}
				{#if canModerate}
					<a
						href="/user/moderation"
						class="mod-link fade"
						aria-label="Moderation"
						title="Moderation"
					>
						<i class="ri-shield-user-line" aria-hidden="true"></i>
					</a>
				{/if}
				<a href="/user/profile" class="user-link label fade">
					<Avatar avatarKey={session.user.avatarKey} size={28} />
					<span class="username">{session.user.displayName}</span>
				</a>
				<span class="fade logout-wrap"><LogoutButton /></span>
			{:else if session.status === 'anon' || session.hint === 'anon'}
				<a href="/auth" class="label nav-link fade">Sign in</a>
			{:else if session.hint === 'user'}
				<span class="avatar-placeholder" aria-hidden="true"></span>
			{/if}
		</div>
		<ThemeToggle />
		<NavbarMenu />
	</div>
</nav>

<style lang="postcss">
	@reference "../../../app.css";

	nav {
		@apply flex items-center justify-between gap-md py-md;
		@apply border-b border-border;
	}

	.wordmark {
		@apply text-brand text-xl font-semibold no-underline shrink-0;
	}

	.actions {
		@apply flex items-center gap-md min-w-0;
	}

	.nav-link {
		@apply text-ink-muted no-underline shrink-0;
	}

	.nav-link:hover {
		@apply text-brand;
	}

	/* Below md the text links collapse into the NavbarMenu dropdown; the bar keeps
	   the search trigger, account chip, theme toggle, and hamburger. */
	.links {
		@apply contents;
	}

	/* Reserved auth slot: one fixed box for pending, signed-out and signed-in, so the
	   client-side session resolving never shifts the bar. Content aligns right; the
	   username is the only flexible part and truncates to fit. */
	.auth-slot {
		@apply flex items-center justify-end gap-md shrink-0 overflow-hidden;
		width: 10.5rem;
		height: 1.75rem;
	}

	.user-link {
		@apply flex items-center gap-xs no-underline text-ink-muted min-w-0 hover:text-brand;
	}

	.user-link :global(svg) {
		@apply shrink-0;
	}

	.username {
		@apply text-sm truncate;
	}

	.logout-wrap {
		@apply flex shrink-0;
	}

	.mod-link {
		@apply flex shrink-0 text-ink-muted no-underline leading-none hover:text-brand;
		font-size: 1.125rem;
	}

	/* Same circle as the default avatar, in the quiet "no data" tone. */
	.avatar-placeholder {
		@apply block shrink-0 rounded-full;
		width: 1.75rem;
		height: 1.75rem;
		background-color: var(--secondary-soft);
	}

	.fade {
		animation: fade-in 0.15s ease;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fade {
			animation: none;
		}
	}

	@media (max-width: 767px) {
		.links {
			display: none;
		}

		/* The dropdown menu carries the Moderation link below md. */
		.mod-link {
			display: none;
		}
	}

	@media (max-width: 479px) {
		.auth-slot {
			width: 5.5rem;
		}

		.username {
			display: none;
		}
	}
</style>
