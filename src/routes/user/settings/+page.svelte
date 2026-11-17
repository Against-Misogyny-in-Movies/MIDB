<script lang="ts">
	import LogoutButton from '#lib/components/auth/logoutButton.svelte';
	import OnThisPageLayout from '#lib/components/resources/onThisPageLayout.svelte';
	import AccountDataCard from '#lib/components/user/accountDataCard.svelte';
	import AppearanceCard from '#lib/components/user/appearanceCard.svelte';
	import SessionsCard from '#lib/components/user/sessionsCard.svelte';
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
		{ id: 'sign-in-methods', label: 'Sign-in methods' },
		{ id: 'sessions', label: 'Sessions' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'account-data', label: 'Account data' }
	];

	// The providers this deployment offers: the email can only come from one of them.
	const providerNames = $derived(
		AUTH_PROVIDERS.filter((p) => data.providers[p.id])
			.map((p) => p.label)
			.join(' or ')
	);
	const emailHint = $derived(
		providerNames
			? `Taken from the first ${providerNames} account used with it, and fixed after that. Not shown on the profile or on comments.`
			: 'Not shown on the profile or on comments.'
	);
	const noEmailHint = $derived(
		providerNames
			? `This account has no email. Linking a ${providerNames} account can add one.`
			: 'This account has no email.'
	);
</script>

<svelte:head>
	<title>Settings · MIDB</title>
</svelte:head>

<div class="settings">
	<OnThisPageLayout items={sections} columnWidth="36rem" breakpoint="lg" centered>
		<div class="column">
			<header>
				<div class="title-row">
					<h1 class="display">Settings</h1>
					<LogoutButton />
				</div>
				<div class="identity">
					<span class="avatar"><Avatar avatarKey={data.me.avatarKey} size={40} /></span>
					<div class="who">
						<span class="username">{data.me.displayName}</span>
						<a href={profileHref(data.me.username) ?? '/user/profile'} class="link">View profile</a>
					</div>
				</div>
			</header>

			<section id="email" class="card plain" aria-labelledby="email-heading">
				<h2 id="email-heading">Email</h2>
				{#if data.email}
					<p class="email">{data.email}</p>
					<p class="hint">{emailHint}</p>
				{:else}
					<p class="hint">{noEmailHint}</p>
				{/if}
			</section>

			<SignInMethodsCard providers={data.providers} initial={data.methods} />
			<SessionsCard initialCount={data.sessions} />
			<AppearanceCard />
			<AccountDataCard />
		</div>
	</OnThisPageLayout>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.settings {
		padding-block: var(--spacing-xl);
	}

	.column {
		@apply flex flex-col min-w-0 w-full mx-auto;
		max-width: 36rem;
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
	}

	.avatar {
		@apply shrink-0;
		display: inline-flex;
	}

	/* The username wraps; the link never does. */
	.who {
		@apply flex flex-col items-start min-w-0;
	}

	.username {
		@apply font-medium min-w-0;
		overflow-wrap: anywhere;
	}

	.who .link {
		white-space: nowrap;
	}

	@media (pointer: coarse) {
		.who .link {
			@apply inline-flex items-center;
			min-height: 2.75rem;
		}
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
