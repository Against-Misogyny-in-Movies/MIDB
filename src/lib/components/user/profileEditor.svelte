<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import AvatarPicker from '#lib/components/user/avatars/AvatarPicker.svelte';
	import {
		NEW_USERNAME_MIN,
		NEW_USERNAME_PATTERN,
		NEW_USERNAME_RE,
		RETIRED_USERNAME_DAYS,
		USERNAME_CHANGE_WAIT_DAYS,
		USERNAME_MAX
	} from '#lib/media/utils/username.ts';
	import { isStaff } from '#lib/media/utils/staff.ts';
	import { DebouncedQuery } from '#lib/media/utils/debouncedQuery.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import type { SubmitFunction } from '$app/forms';
	import type { PublicUser } from '#lib/media/types/user.ts';

	interface Props {
		/** The account as it is saved now. */
		user: PublicUser;
		/** The account as the server stored it after a save that went through. */
		onsaved: (me: PublicUser) => void;
		oncancel: () => void;
	}

	let { user, onsaved, oncancel }: Props = $props();

	// The editor starts from the saved account; a later save hands the new one to the page.
	// svelte-ignore state_referenced_locally
	let selectedAvatar = $state<string | null>(user.avatarKey);
	// svelte-ignore state_referenced_locally
	let usernameInput = $state(user.username ?? '');
	let field: HTMLInputElement | undefined = $state();

	onMount(() => field?.focus());
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
			const res = await fetch(`/user/settings/availability?username=${encodeURIComponent(value)}`, {
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
		if (!value || value === user.username || !NEW_USERNAME_RE.test(value)) {
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
	const changingUsername = $derived(usernameInput !== (user.username ?? ''));

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

	/**
	 * Saves the profile: the result is a toast, except a refused username, which its field shows.
	 * The action belongs to `/user/settings`, so the result is handled here and never applied to
	 * the profile page's own data.
	 */
	const saveProfile: SubmitFunction = () => {
		saving = true;
		shapeChecked = true;
		const before: Profile = { username: user.username ?? '', avatarKey: user.avatarKey };
		return async ({ result }) => {
			saving = false;
			if (result.type === 'success') {
				status = 'idle';
				// The account as the server stored it (a username is lowercased), not as typed.
				const me = result.data?.me as PublicUser | undefined;
				announceSave(before, {
					username: me?.username ?? before.username,
					avatarKey: me?.avatarKey ?? before.avatarKey
				});
				if (me) onsaved(me);
			} else if (result.type === 'error') {
				toasts.error('The profile could not be saved. Try again.');
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
</script>

<form
	method="POST"
	novalidate
	action="/user/settings?/updateProfile"
	use:enhance={saveProfile}
	class="card editor"
	aria-busy={saving}
	aria-labelledby="editor-heading"
>
	<h2 id="editor-heading">Edit profile</h2>
	<input type="hidden" name="avatarKey" value={selectedAvatar ?? ''} />

	<div class="field">
		<label for="username">Username</label>
		<input
			id="username"
			name="username"
			type="text"
			class="input"
			value={usernameInput}
			bind:this={field}
			oninput={onUsernameInput}
			onblur={() => (shapeChecked = true)}
			minlength={changingUsername ? NEW_USERNAME_MIN : undefined}
			maxlength={USERNAME_MAX}
			pattern={changingUsername ? NEW_USERNAME_PATTERN : undefined}
			autocomplete="off"
			spellcheck="false"
			aria-describedby="username-rule username-status{changingUsername ? ' username-rename' : ''}"
			aria-invalid={shapeInvalid ||
			(status !== 'idle' && status !== 'checking' && status !== 'available')
				? true
				: undefined}
		/>
		<p id="username-rule" class="hint" class:hint--taken={shapeInvalid}>
			Shown on comments and in the profile's address. {USERNAME_RULE}
		</p>
		<p id="username-status" class="hint hint--{status} status" aria-live="polite">{statusText}</p>
		{#if changingUsername}
			<p id="username-rename" class="rename">
				After a rename, links to /u/{user.username} stop working{isStaff(user.role)
					? '.'
					: `, and the username cannot change again for ${USERNAME_CHANGE_WAIT_DAYS} days.`}
			</p>
		{/if}
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

	<div class="buttons">
		<button type="submit" class="btn btn--brand" aria-busy={saving}>Save profile</button>
		<button type="button" class="btn btn--ghost" onclick={oncancel}>Cancel</button>
	</div>
</form>

<style lang="postcss">
	@reference "../../../app.css";

	.editor {
		@apply flex flex-col;
		gap: var(--spacing-lg);
		padding: 24px;
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
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

	/* One slot for the longest line (the taken text: three lines on a phone, two from 40rem), so a state change moves nothing below the field. */
	.status {
		min-height: 3.75rem;
	}

	@media (min-width: 40rem) {
		.status {
			min-height: 2.5rem;
		}
	}

	.hint--format,
	.hint--reserved,
	.hint--blocked,
	.hint--too-soon {
		color: var(--danger);
	}

	/* What a rename costs, in the warn plate the moderation consequences use. */
	.rename {
		@apply text-sm;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: 8px;
		background-color: var(--warn-soft);
		color: var(--warn);
	}

	.buttons {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
