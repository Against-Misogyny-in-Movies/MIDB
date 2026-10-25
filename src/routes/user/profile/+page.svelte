<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '$lib/components/user/avatars/Avatar.svelte';
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

<div class="profile-page">
	<header class="profile-header">
		<Avatar avatarKey={user?.avatarKey} size={72} />
		<div class="profile-meta">
			<h1 class="display profile-name">
				{#if user?.username}
					{user.username}
				{:else}
					<span class="prompt">Set a username</span>
				{/if}
			</h1>
			{#if data.email}
				<p class="profile-email label">{data.email}</p>
			{/if}
			{#if user?.role}
				<span class="role-badge role-{user.role}">{roleLabel(user.role)}</span>
			{/if}
		</div>
	</header>

	{#if form?.error}
		<div class="form-error" role="alert">
			{#if form.error === 'username-taken'}Username is already taken.
			{:else if form.error === 'username-format'}Username must be 3–32 characters: lowercase
				letters, numbers, underscores only.
			{:else if form.error === 'username-reserved'}That username is reserved.
			{:else if form.error === 'avatar-invalid'}Please choose a valid avatar.
			{:else}Something went wrong. Please try again.
			{/if}
		</div>
	{/if}

	{#if form?.success}
		<div class="form-success" role="status">Profile updated.</div>
	{/if}

	<form method="POST" action="?/updateProfile" use:enhance class="profile-form">
		<input type="hidden" name="avatarKey" value={selectedAvatar ?? ''} />

		<section class="form-section">
			<label for="username" class="field-label">Username</label>
			<input
				id="username"
				name="username"
				type="text"
				class="field-input"
				value={usernameInput}
				oninput={(e) => {
					usernameInput = (e.target as HTMLInputElement).value;
					checkAvailability(usernameInput);
				}}
				placeholder="choose a username"
				maxlength="32"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if availability === 'checking'}
				<span class="avail-hint checking">Checking…</span>
			{:else if availability === 'available'}
				<span class="avail-hint available">Available</span>
			{:else if availability === 'taken'}
				<span class="avail-hint taken">Already taken</span>
			{/if}
		</section>

		<section class="form-section">
			<p class="field-label">Avatar</p>
			<AvatarPicker
				value={selectedAvatar}
				onselect={(key) => {
					selectedAvatar = key;
				}}
			/>
		</section>

		<button type="submit" class="save-btn label">Save profile</button>
	</form>

	<nav class="profile-nav label">
		<a href="/user/dashboard">Account settings</a>
		<a href="/user/comments">Comment history</a>
		<a href="/user/metrics">Rating history</a>
	</nav>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.profile-page {
		@apply max-w-lg mx-auto py-lg flex flex-col gap-lg;
	}

	.profile-header {
		@apply flex items-center gap-md;
	}

	.profile-meta {
		@apply flex flex-col gap-xs;
	}

	.profile-name {
		@apply text-2xl font-semibold text-ink;
	}

	.prompt {
		@apply text-ink-muted;
	}

	.profile-email {
		@apply text-ink-muted text-sm;
	}

	.role-badge {
		@apply text-xs font-medium px-sm py-xs rounded-full w-fit;
	}

	.role-user {
		@apply bg-surface-raised text-ink-muted border border-border;
	}
	.role-moderator {
		@apply bg-info-soft text-info-fg;
	}
	.role-administrator {
		@apply bg-brand text-surface;
	}

	.form-error {
		@apply text-sm text-danger border border-danger-soft bg-danger-soft rounded-lg px-md py-sm;
	}

	.form-success {
		@apply text-sm text-success border border-success-soft bg-success-soft rounded-lg px-md py-sm;
	}

	.profile-form {
		@apply flex flex-col gap-lg;
	}

	.form-section {
		@apply flex flex-col gap-sm;
	}

	.field-label {
		@apply text-sm font-medium text-ink;
	}

	.field-input {
		@apply w-full border border-border rounded-lg px-md py-sm text-ink bg-surface-raised;
		@apply focus:outline-none focus:border-brand;
	}

	.avail-hint {
		@apply text-xs mt-xs;
	}

	.avail-hint.checking {
		@apply text-ink-muted;
	}
	.avail-hint.available {
		@apply text-success;
	}
	.avail-hint.taken {
		@apply text-danger;
	}

	.save-btn {
		@apply self-start px-lg py-sm rounded-lg bg-brand text-surface cursor-pointer border-0;
		@apply hover:bg-brand-strong transition-colors;
	}

	.profile-nav {
		@apply flex gap-md text-sm border-t border-border pt-md;

		a {
			@apply text-ink-muted no-underline hover:text-brand;
		}
	}
</style>
