<script lang="ts">
	import { page } from '$app/stores';
	import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
	import Avatar from '$lib/components/user/avatars/Avatar.svelte';
	import LogoutButton from '$lib/components/auth/logoutButton.svelte';
	import type { UserRow } from '$lib/media/types/user';
	import NavbarSearch from './navbarSearch.svelte';
	import NavbarMenu from './navbarMenu.svelte';

	interface Props {
		user?: UserRow | null;
	}

	let { user = null }: Props = $props();

	const showSearch = $derived($page.url.pathname !== '/');
	const canModerate = $derived(user?.role === 'moderator' || user?.role === 'administrator');

	function displayName(u: UserRow): string {
		if (u.username) return u.username;
		if (u.email) return u.email.split('@')[0];
		return 'Account';
	}
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
			{#if canModerate}
				<a href="/user/moderation" class="label nav-link">Moderation</a>
			{/if}
			{#if !user}
				<a href="/auth" class="label nav-link">Sign in</a>
			{/if}
		</div>
		{#if user}
			<a href="/user/profile" class="user-link label">
				<Avatar avatarKey={user.avatarKey} size={28} />
				<span class="username">{displayName(user)}</span>
			</a>
			<LogoutButton />
		{/if}
		<ThemeToggle />
		<NavbarMenu {user} />
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

	.user-link {
		@apply flex items-center gap-xs no-underline text-ink-muted shrink-0 hover:text-brand;
	}

	.username {
		@apply text-sm;
	}

	@media (max-width: 767px) {
		.links {
			display: none;
		}
	}

	@media (max-width: 479px) {
		.username {
			display: none;
		}
	}
</style>
