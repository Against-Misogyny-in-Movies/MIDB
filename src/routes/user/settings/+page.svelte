<script lang="ts">
	import LogoutButton from '#lib/components/auth/logoutButton.svelte';
	import ResourceNav from '#lib/components/resources/resourceNav.svelte';
	import SignInMethodsCard from '#lib/components/user/signInMethodsCard.svelte';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import { AUTH_PROVIDERS } from '#lib/media/utils/auth-providers.ts';
	import { profileHref } from '#lib/media/utils/profileHref.ts';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// One entry per section on the page, in order.
	const sections = [
		{ id: 'email', label: 'Email' },
		{ id: 'sign-in-methods', label: 'Sign-in methods' }
	];

	const providerNames = AUTH_PROVIDERS.map((p) => p.label).join(' or ');
</script>

<svelte:head>
	<title>Settings · MIDB</title>
</svelte:head>

<div class="settings">
	<aside class="nav-col">
		<ResourceNav items={sections} />
	</aside>

	<div class="column">
		<header>
			<div class="title-row">
				<h1 class="display">Settings</h1>
				<LogoutButton />
			</div>
			<div class="identity">
				<Avatar avatarKey={data.me.avatarKey} size={40} />
				<span class="username">{data.me.displayName}</span>
				<a href={profileHref(data.me.username) ?? '/user/profile'} class="link">View profile</a>
			</div>
		</header>

		<section id="email" class="card plain" aria-labelledby="email-heading">
			<h2 id="email-heading">Email</h2>
			{#if data.email}
				<p class="email">{data.email}</p>
				<p class="hint">
					Taken from a linked {providerNames} account and not editable here. Not shown on the profile
					or on comments.
				</p>
			{:else}
				<p class="hint">
					This account has no email. Linking a {providerNames} account can add one.
				</p>
			{/if}
		</section>

		<SignInMethodsCard providers={data.providers} />
	</div>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.settings {
		@apply grid mx-auto;
		grid-template-columns: minmax(0, 1fr);
		max-width: 36rem;
		padding-block: var(--spacing-xl);
	}

	/* The "On this page" list needs the width beside the column; below it the page is the column alone. */
	.nav-col {
		@apply hidden;
	}

	@media (min-width: 56rem) {
		.settings {
			grid-template-columns: 12rem minmax(0, 36rem);
			gap: var(--spacing-xl);
			max-width: none;
			justify-content: center;
			align-items: start;
		}

		.nav-col {
			@apply block sticky;
			top: 5rem;
		}
	}

	.column {
		@apply flex flex-col min-w-0;
		gap: var(--spacing-lg);
	}

	h1 {
		font-size: 1.875rem;
	}

	/* Sign out sits beside the title, so the cards loading below it never move it. */
	.title-row {
		@apply flex flex-wrap items-center justify-between;
		gap: var(--spacing-sm) var(--spacing-md);
	}

	.identity {
		@apply flex items-center text-sm;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
		min-height: 2.75rem;
	}

	.username {
		@apply font-medium min-w-0;
		overflow-wrap: anywhere;
	}

	.identity :global(svg) {
		@apply shrink-0;
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
	}

	.plain {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: 24px;
		scroll-margin-top: 5rem;
	}

	.email {
		overflow-wrap: anywhere;
	}

	.hint {
		@apply text-sm text-ink-muted;
	}
</style>
