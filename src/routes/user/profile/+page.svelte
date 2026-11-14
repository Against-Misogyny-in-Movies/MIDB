<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import LogoutButton from '#lib/components/auth/logoutButton.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import AvatarPicker from '#lib/components/user/avatars/AvatarPicker.svelte';
	import {
		NEW_USERNAME_MIN,
		NEW_USERNAME_PATTERN,
		NEW_USERNAME_RE,
		RETIRED_USERNAME_DAYS,
		USERNAME_CHANGE_WAIT_DAYS,
		USERNAME_MAX
	} from '#lib/media/utils/username.ts';
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
	/** What the username field's live slot shows: a check in progress, its answer, or a refused save. */
	type Status =
		| 'idle'
		| 'checking'
		| 'available'
		| 'taken'
		| 'reserved'
		| 'blocked'
		| 'format'
		| 'too-soon';
	let status = $state<Status>('idle');

	/** A refusal the form or the availability check gives, by the reason it names. */
	const REFUSALS = ['taken', 'reserved', 'blocked', 'format', 'too-soon'] as const;
	const refusalOf = (reason: unknown): Status | undefined => REFUSALS.find((r) => r === reason);

	// A newer keystroke aborts the in-flight check, so a slow answer for an older
	// value never overwrites the current one. An error response (e.g. a 429) shows nothing.
	const availabilityCheck = new DebouncedQuery<Status>(
		async (value, signal) => {
			const res = await fetch(`/user/profile/availability?username=${encodeURIComponent(value)}`, {
				signal
			});
			if (!res.ok) return 'idle';
			const { available, reason } = (await res.json()) as { available: boolean; reason?: string };
			return available ? 'available' : (refusalOf(reason) ?? 'taken');
		},
		(result) => (status = result),
		{ empty: 'idle', delayMs: 400 }
	);

	function checkAvailability(value: string) {
		if (!value || value === user?.username || !NEW_USERNAME_RE.test(value)) {
			availabilityCheck.cancel();
			status = 'idle';
			return;
		}
		status = 'checking';
		availabilityCheck.push(value);
	}

	/** The field holds a name as the site stores it: no spaces, lowercase. */
	function onUsernameInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const value = input.value.trim().toLowerCase();
		if (input.value !== value) input.value = value;
		usernameInput = value;
		checkAvailability(value);
	}

	const USERNAME_RULE = `A new username is ${NEW_USERNAME_MIN}–${USERNAME_MAX} characters: lowercase letters, numbers and single underscores. It starts with a letter and does not end with an underscore.`;

	/** The new-name rule binds a changed name only: a stored name that predates it saves as it is. */
	const changingUsername = $derived(usernameInput !== (user?.username ?? ''));

	/** A refusal of the username, shown in the field's live slot. */
	const USERNAME_ERRORS: Record<string, string> = {
		taken: `That username, or one that looks like it, belongs to another account or was given up in the last ${RETIRED_USERNAME_DAYS} days.`,
		reserved: 'That username is reserved.',
		blocked: 'That username is not allowed.',
		'too-soon': `A username can change once every ${USERNAME_CHANGE_WAIT_DAYS} days.`
	};
	let saving = $state(false);
	/** Whether the field was left or saved, so a shape error does not show while the reader is still typing. */
	let shapeChecked = $state(false);
	/** The name breaks the shape rule: the rule line shows in the field's error state. */
	const shapeInvalid = $derived(
		status === 'format' ||
			(shapeChecked &&
				changingUsername &&
				usernameInput !== '' &&
				!NEW_USERNAME_RE.test(usernameInput))
	);
	const statusText = $derived(
		status === 'checking'
			? 'Checking…'
			: status === 'available'
				? 'Available'
				: (USERNAME_ERRORS[status] ?? '')
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
	const saveProfile: SubmitFunction = () => {
		saving = true;
		shapeChecked = true;
		const before: Profile = { username: user?.username ?? '', avatarKey: user?.avatarKey ?? null };
		return async ({ result, update }) => {
			await update();
			saving = false;
			if (result.type === 'success') {
				status = 'idle';
				// The account as the server stored it (a username is lowercased), not as typed.
				const me = result.data?.me as Partial<Profile> | undefined;
				announceSave(before, {
					username: me?.username ?? before.username,
					avatarKey: me?.avatarKey ?? before.avatarKey
				});
			} else if (result.type === 'failure') {
				const error = result.data?.error;
				// A refused username replaces the availability state in its field instead of a toast.
				const refusal =
					typeof error === 'string' && error.startsWith('username-')
						? refusalOf(error.slice('username-'.length))
						: undefined;
				if (refusal) {
					availabilityCheck.cancel();
					status = refusal;
					return;
				}
				toasts.error(
					error === 'avatar-invalid'
						? 'That avatar is not available. Choose another.'
						: error === 'no-changes'
							? 'Nothing to save: enter a username or choose an avatar.'
							: error === 'muted'
								? 'The profile cannot change while the account is muted.'
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
		novalidate
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
				oninput={onUsernameInput}
				onblur={() => (shapeChecked = true)}
				minlength={changingUsername ? NEW_USERNAME_MIN : undefined}
				maxlength={USERNAME_MAX}
				pattern={changingUsername ? NEW_USERNAME_PATTERN : undefined}
				autocomplete="off"
				spellcheck="false"
				aria-describedby="username-rule username-status"
				aria-invalid={shapeInvalid ||
				(status !== 'idle' && status !== 'checking' && status !== 'available')
					? true
					: undefined}
			/>
			<p id="username-rule" class="hint" class:hint--taken={shapeInvalid}>
				Shown on comments. {USERNAME_RULE}
			</p>
			<p id="username-status" class="hint hint--{status} status" aria-live="polite">{statusText}</p>
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

	/* One slot for the longest line, so a state change moves nothing below the field. */
	.status {
		min-height: calc(var(--status-lines, 3) * 1.25rem);
	}

	.hint--format,
	.hint--reserved,
	.hint--blocked,
	.hint--too-soon {
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
