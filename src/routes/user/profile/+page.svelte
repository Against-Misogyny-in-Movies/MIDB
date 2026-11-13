<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import LogoutButton from '#lib/components/auth/logoutButton.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import AvatarPicker from '#lib/components/user/avatars/AvatarPicker.svelte';
	import { profileHref } from '#lib/media/utils/profileHref.ts';
	import { DebouncedQuery } from '#lib/media/utils/debouncedQuery.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import type { SubmitFunction } from '$app/forms';

	let { data, form } = $props();

	const user = $derived(form?.me ?? data.me);
	const publicHref = $derived(profileHref(user?.username));

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
			const { available } = (await res.json()) as { available: boolean };
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

	/** A refusal of the username, shown under its field. */
	const USERNAME_ERRORS: Record<string, string> = {
		'username-taken': 'That username is already taken.',
		'username-format': 'A username is 3–32 characters: lowercase letters, numbers and underscores.',
		'username-reserved': 'That username is reserved.'
	};
	let saving = $state(false);
	/** The username the last save sent: its refusal shows only while the field still holds it. */
	let submittedUsername = $state<string | null>(null);
	const usernameError = $derived(
		typeof form?.error === 'string' && usernameInput === submittedUsername
			? USERNAME_ERRORS[form.error]
			: undefined
	);

	type Profile = { username: string; avatarKey: string | null };

	/** Toasts what a save changed. */
	function announceSave(before: Profile, after: Profile) {
		const username = after.username !== before.username;
		const avatar = after.avatarKey !== before.avatarKey;
		if (username && avatar)
			toasts.success(`Username changed to ${after.username}, and avatar changed.`);
		else if (username) toasts.success(`Username changed to ${after.username}.`);
		else if (avatar) toasts.success('Avatar changed.');
		else toasts.warn('Nothing changed: the username and avatar are the ones already saved.');
	}

	/** Saves the profile: the result is a toast, except a refused username, which its field shows. */
	const saveProfile: SubmitFunction = ({ formData }) => {
		saving = true;
		submittedUsername = String(formData.get('username') ?? '');
		const before: Profile = { username: user?.username ?? '', avatarKey: user?.avatarKey ?? null };
		return async ({ result, update }) => {
			await update();
			saving = false;
			if (result.type === 'success') {
				// The account as the server stored it (a username is lowercased), not as typed.
				const me = result.data?.me as Partial<Profile> | undefined;
				announceSave(before, {
					username: me?.username ?? before.username,
					avatarKey: me?.avatarKey ?? before.avatarKey
				});
			} else if (result.type === 'failure') {
				const error = result.data?.error;
				if (typeof error === 'string' && USERNAME_ERRORS[error]) return;
				toasts.error(
					error === 'avatar-invalid'
						? 'That avatar is not available. Choose another.'
						: error === 'no-changes'
							? 'Nothing to save: enter a username or choose an avatar.'
							: 'The profile could not be saved. Try again.'
				);
			}
		};
	};

	function roleLabel(role: string) {
		return { user: 'Member', moderator: 'Moderator', administrator: 'Administrator' }[role] ?? role;
	}
</script>

<div class="account-page">
	<header class="profile-header">
		<Avatar avatarKey={user?.avatarKey} size={64} />
		<div class="profile-meta">
			<h1 class="display">
				{user?.username ?? 'Account'}
			</h1>
			<p class="details">
				{#if data.email}<span>{data.email}</span>{/if}
				{#if user?.role}<Badge tone={user.role === 'user' ? 'neutral' : 'brand'}
						>{roleLabel(user.role)}</Badge
					>{/if}
			</p>
		</div>
	</header>

	<form
		method="POST"
		action="?/updateProfile"
		use:enhance={saveProfile}
		class="card profile-form"
		aria-busy={saving}
	>
		<input type="hidden" name="avatarKey" value={selectedAvatar ?? ''} />

		<div class="field">
			<label for="username">Username</label>
			<input
				id="username"
				name="username"
				type="text"
				class="input"
				value={usernameInput}
				oninput={(e) => {
					usernameInput = (e.target as HTMLInputElement).value;
					checkAvailability(usernameInput);
				}}
				maxlength="32"
				autocomplete="off"
				spellcheck="false"
				aria-describedby="username-hint"
				aria-invalid={usernameError && availability === 'idle' ? true : undefined}
			/>
			<p
				id="username-hint"
				class="hint hint--{usernameError && availability === 'idle' ? 'taken' : availability}"
				aria-live="polite"
			>
				{#if usernameError && availability === 'idle'}{usernameError}
				{:else if availability === 'checking'}Checking…
				{:else if availability === 'available'}Available
				{:else if availability === 'taken'}Already taken
				{:else}Shown on comments. Change it here: lowercase letters, numbers and underscores.
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

		<button type="submit" class="btn btn--brand save" aria-busy={saving}> Save profile </button>
	</form>

	<nav class="card account-nav" aria-label="Account">
		{#if publicHref}
			<a href={publicHref}
				>Public profile <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
			>
		{/if}
		<a href="/user/security"
			>Sign-in methods <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
		>
		<a href="/user/comments"
			>Comment history <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
		>
		<a href="/user/metrics"
			>MIDB community reports <i class="ri-arrow-right-s-line" aria-hidden="true"></i></a
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
		@apply truncate;
		font-size: 1.875rem;
	}

	.details {
		@apply flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-ink-muted;
	}

	.profile-form {
		@apply flex flex-col;
		gap: var(--spacing-lg);
		padding: 24px;
	}

	.field {
		@apply flex flex-col gap-xs border-0 m-0 p-0 min-w-0;
	}

	label,
	legend {
		@apply font-medium text-ink p-0;
		margin-bottom: var(--spacing-xs);
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
		@apply self-start;
	}

	.account-nav {
		@apply flex flex-col overflow-hidden;
	}

	.account-nav a {
		@apply flex items-center justify-between no-underline text-ink font-medium;
		padding: 14px 20px;
		transition: color 0.15s ease;
	}

	.account-nav a + a {
		border-top: 1px solid var(--border);
	}

	.account-nav a:hover {
		color: var(--brand);
	}

	.account-nav i {
		@apply text-ink-muted text-lg;
	}
</style>
