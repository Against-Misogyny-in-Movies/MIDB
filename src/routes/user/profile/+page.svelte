<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '$lib/components/user/avatars/Avatar.svelte';
	import LogoutButton from '$lib/components/auth/logoutButton.svelte';
	import AvatarPicker from '$lib/components/user/avatars/AvatarPicker.svelte';
	import { DebouncedQuery } from '$lib/media/utils/debouncedQuery.svelte.js';

	let { data, form } = $props();

	const user = $derived(form?.me ?? data.me);

	let selectedAvatar = $state<string | null>(null);
	let usernameInput = $state('');

	$effect.pre(() => {
		selectedAvatar = user?.avatarKey ?? null;
		usernameInput = user?.username ?? '';
	});
	type Availability = 'idle' | 'checking' | 'available' | 'taken';
	let availability: Availability = $state('idle');

	// A newer keystroke aborts the in-flight check, so a slow answer for an older
	// value never overwrites the current one. An error response (e.g. a 429) shows nothing.
	const availabilityCheck = new DebouncedQuery<Availability>(
		async (value, signal) => {
			const res = await fetch(`/user/profile/availability?username=${encodeURIComponent(value)}`, {
				signal
			});
			if (!res.ok) return 'idle';
			const { available } = await res.json();
			return available ? 'available' : 'taken';
		},
		(result) => (availability = result),
		{ empty: 'idle', delayMs: 400 }
	);

	function checkAvailability(value: string) {
		if (!value || value === user?.username) {
			availabilityCheck.cancel();
			availability = 'idle';
			return;
		}
		availability = 'checking';
		availabilityCheck.push(value);
	}

	function roleLabel(role: string) {
		return { user: 'Member', moderator: 'Moderator', administrator: 'Administrator' }[role] ?? role;
	}
</script>

<div class="account-page">
	<header class="profile-header">
		<Avatar avatarKey={user?.avatarKey} size={64} />
		<div class="profile-meta">
			<h1 class="display">
				{#if user?.username}
					{user.username}
				{:else}
					<span class="prompt">Set a username</span>
				{/if}
			</h1>
			<p class="details">
				{#if data.email}<span>{data.email}</span>{/if}
				{#if user?.role}<span class="role role-{user.role}">{roleLabel(user.role)}</span>{/if}
			</p>
		</div>
	</header>

	{#if form?.error}
		<p class="notice notice--error" role="alert">
			{#if form.error === 'username-taken'}That username is already taken.
			{:else if form.error === 'username-format'}A username is 3–32 characters: lowercase letters,
				numbers and underscores.
			{:else if form.error === 'username-reserved'}That username is reserved.
			{:else if form.error === 'avatar-invalid'}That avatar is not available. Choose another.
			{:else}The profile could not be saved. Try again.
			{/if}
		</p>
	{/if}

	{#if form?.success}
		<p class="notice notice--success" role="status">Profile saved.</p>
	{/if}

	<form method="POST" action="?/updateProfile" use:enhance class="profile-form">
		<input type="hidden" name="avatarKey" value={selectedAvatar ?? ''} />

		<div class="field">
			<label for="username">Username</label>
			<input
				id="username"
				name="username"
				type="text"
				value={usernameInput}
				oninput={(e) => {
					usernameInput = (e.target as HTMLInputElement).value;
					checkAvailability(usernameInput);
				}}
				placeholder="choose a username"
				maxlength="32"
				autocomplete="off"
				spellcheck="false"
				aria-describedby="username-hint"
			/>
			<p id="username-hint" class="hint hint--{availability}" aria-live="polite">
				{#if availability === 'checking'}Checking…
				{:else if availability === 'available'}Available
				{:else if availability === 'taken'}Already taken
				{:else}Lowercase letters, numbers and underscores.
				{/if}
			</p>
		</div>

		<fieldset class="field">
			<legend>Avatar</legend>
			<AvatarPicker
				value={selectedAvatar}
				onselect={(key) => {
					selectedAvatar = key;
				}}
			/>
		</fieldset>

		<button type="submit" class="save">Save profile</button>
	</form>

	<nav class="account-nav" aria-label="Account">
		<a href="/user/dashboard"
			>Account settings <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
		>
		<a href="/user/comments"
			>Comment history <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
		>
		<a href="/user/metrics"
			>Rating history <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
		>
	</nav>

	<p><LogoutButton /></p>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.account-page {
		@apply flex flex-col mx-auto;
		max-width: 36rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.profile-header {
		@apply flex items-center gap-md;
	}

	.profile-meta {
		@apply flex flex-col gap-xs min-w-0;
	}

	h1 {
		@apply text-4xl truncate;
	}

	.prompt {
		@apply text-ink-muted;
	}

	.details {
		@apply flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-ink-muted;
	}

	.role {
		@apply font-medium;
	}

	.role-moderator {
		color: var(--info);
	}

	.role-administrator {
		color: var(--brand);
	}

	.notice {
		@apply text-sm rounded-md;
		padding: var(--spacing-sm) var(--spacing-md);
	}

	.notice--error {
		background-color: var(--danger-soft);
		color: var(--danger);
	}

	.notice--success {
		background-color: var(--success-soft);
		color: var(--success);
	}

	.profile-form {
		@apply flex flex-col;
		gap: var(--spacing-lg);
	}

	.field {
		@apply flex flex-col gap-xs border-0 m-0 p-0 min-w-0;
	}

	label,
	legend {
		@apply font-medium text-ink p-0;
		margin-bottom: var(--spacing-xs);
	}

	input[type='text'] {
		@apply w-full rounded-md text-ink bg-surface-raised;
		height: 2.75rem;
		padding-inline: var(--spacing-md);
		border: 1px solid var(--border-strong);
		transition: border-color 0.15s ease;
	}

	input[type='text']:hover {
		border-color: var(--ink-muted);
	}

	input[type='text']:focus-visible {
		@apply outline-none;
		border-color: var(--brand);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent);
	}

	.hint {
		@apply text-sm text-ink-muted;
	}

	.hint--available {
		color: var(--success);
	}

	.hint--taken {
		color: var(--danger);
	}

	.save {
		@apply self-start rounded-md font-semibold border-0 cursor-pointer;
		padding: var(--spacing-sm) var(--spacing-md);
		background-color: var(--brand);
		color: var(--surface-raised);
		transition: background-color 0.15s ease;
	}

	.save:hover {
		background-color: var(--brand-strong);
	}

	.account-nav {
		@apply flex flex-col border-t border-border;
	}

	.account-nav a {
		@apply flex items-center justify-between no-underline text-ink border-b border-border;
		padding-block: var(--spacing-sm);
		transition: color 0.15s ease;
	}

	.account-nav a:hover {
		color: var(--brand);
	}

	.account-nav i {
		@apply text-ink-muted text-lg;
	}
</style>
