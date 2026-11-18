<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '#lib/auth-client.ts';
	import Notice from '#lib/components/ui/notice.svelte';
	import SettingsCard from '#lib/components/user/settingsCard.svelte';
	import SettingsPlate from '#lib/components/user/settingsPlate.svelte';
	import {
		ACCOUNT_DELETE_REFUSALS,
		DELETE_SESSION_MAX_AGE_MINUTES,
		type AccountDeleteRefusal
	} from '#lib/media/utils/accountDeletion.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import { RETIRED_USERNAME_DAYS } from '#lib/media/utils/username.ts';

	interface Props {
		/** The username the reader types to confirm. */
		username: string;
		/** Whether the session started within `DELETE_SESSION_MAX_AGE_MINUTES`, as the page's load saw it. */
		sessionRecent: boolean;
	}

	let { username, sessionRecent }: Props = $props();

	const TRIGGER_ID = 'delete-account-trigger';
	const PLATE_TEXT_ID = 'delete-account-plate';
	const NOTICE_ID = 'delete-account-notice';
	const ERROR_ID = 'delete-username-error';
	const SIGN_IN_AGAIN = `/auth?next=${encodeURIComponent('/user/settings#delete-account')}`;

	let open = $state(false);
	let typed = $state('');
	let fieldError = $state('');
	let running = $state(false);
	let signingOut = $state(false);
	// svelte-ignore state_referenced_locally
	let stale = $state(!sessionRecent);
	let lastAdministrator = $state(false);

	/** Moves focus to an element by id once it is rendered. */
	function focusOn(id: string) {
		return focusAfterUpdate(() => document.getElementById(id));
	}

	/** A notice that replaces the form takes the focus; otherwise the plate's first line does. */
	const entryId = () => (stale || lastAdministrator ? NOTICE_ID : PLATE_TEXT_ID);

	function openPlate() {
		open = true;
		void focusOn(entryId());
	}

	function closePlate() {
		open = false;
		typed = '';
		fieldError = '';
		void focusOn(TRIGGER_ID);
	}

	/** The field holds a name as the site stores it: no spaces, lowercase. */
	function onInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const value = input.value.trim().toLowerCase();
		if (input.value !== value) input.value = value;
		typed = value;
		fieldError = '';
	}

	function showMismatch() {
		fieldError = typed === '' ? 'Type the username to confirm.' : 'That is not the username.';
		void focusOn('delete-username');
	}

	/** Signs out, then goes to sign-in with this card as the return path: sign-in skips a signed-in reader. */
	async function signInAgain() {
		if (signingOut) return;
		signingOut = true;
		let failed = false;
		try {
			failed = (await authClient.signOut()).error !== null;
		} catch {
			failed = true;
		}
		if (failed) {
			signingOut = false;
			toasts.error('Sign-out did not go through. Try again in a moment.');
			return;
		}
		session.clear();
		await goto(SIGN_IN_AGAIN, { refreshAll: true });
		signingOut = false;
	}

	/** The form is replaced by a notice; focus goes to the notice's text. */
	function blockWith(reason: 'stale' | 'last-administrator') {
		if (reason === 'stale') stale = true;
		else lastAdministrator = true;
		void focusOn(NOTICE_ID);
	}

	async function refusalOf(response: Response): Promise<AccountDeleteRefusal | null> {
		const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
		return ACCOUNT_DELETE_REFUSALS.find((code) => code === body?.error) ?? null;
	}

	async function deleteAccount(event: SubmitEvent) {
		event.preventDefault();
		if (running) return;
		if (typed === '' || typed !== username.toLowerCase()) {
			showMismatch();
			return;
		}
		running = true;
		try {
			const response = await fetch('/api/me/account', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username: typed })
			});
			if (response.ok) {
				session.clear();
				await goto('/', { refreshAll: true });
				toasts.success('The account was deleted.');
				return;
			}
			if (response.status === 401) {
				session.clear();
				await goto('/auth', { refreshAll: true });
				toasts.warn('The session has ended. Sign in again.');
				return;
			}
			if (response.status === 429) {
				toasts.error('Too many attempts. Try again in a minute.');
				return;
			}
			const refusal = await refusalOf(response);
			if (refusal === 'username-mismatch') showMismatch();
			else if (refusal === 'session-stale') blockWith('stale');
			else if (refusal === 'last-administrator') blockWith('last-administrator');
			else toasts.error('The account could not be deleted. Try again.');
		} catch {
			toasts.error('The account could not be deleted. Try again.');
		} finally {
			running = false;
		}
	}
</script>

<SettingsCard
	id="delete-account"
	headingId="delete-account-heading"
	title="Delete account"
	busy={running}
>
	<p>Deleting the account takes effect at once and cannot be undone.</p>
	<p class="group-label">Removed:</p>
	<ul class="effects">
		<li>The email, sign-in methods and sessions.</li>
		<li>
			The username and avatar. The profile address stops working, and other accounts cannot take the
			username for {RETIRED_USERNAME_DAYS} days.
		</li>
		<li>
			Comments that no other account has replied below, community reports, votes and reports of
			comments.
		</li>
	</ul>
	<p class="group-label">Kept:</p>
	<ul class="effects">
		<li>
			A comment that another account replied to, directly or further down the thread, stays with no
			text and no author, so those replies keep their thread.
		</li>
	</ul>
	<div>
		<button
			type="button"
			id={TRIGGER_ID}
			class="btn btn--ghost"
			aria-expanded={open}
			aria-controls="delete-account-plate-slot"
			onclick={openPlate}
		>
			Delete account
		</button>
	</div>

	{#if open}
		<div id="delete-account-plate-slot">
			<SettingsPlate>
				{#if !lastAdministrator}
					<p id={PLATE_TEXT_ID} tabindex="-1">
						<a href="#account-data" class="link">Download the account's data</a> first if a copy is needed.
					</p>
				{/if}
				{#if stale}
					<Notice tone="warn" id={NOTICE_ID} focusable>
						Deleting the account needs a sign-in from the last {DELETE_SESSION_MAX_AGE_MINUTES} minutes.
						Sign out, then sign in again to come back here.
					</Notice>
					<div class="buttons">
						<button type="button" class="btn btn--ink" aria-busy={signingOut} onclick={signInAgain}>
							Sign out and sign in again
						</button>
						<button type="button" class="btn btn--ghost" onclick={closePlate}>
							Keep the account
						</button>
					</div>
				{:else if lastAdministrator}
					<Notice tone="warn" id={NOTICE_ID} focusable>
						The only administrator cannot delete the account. Another administrator has to exist
						first.
					</Notice>
					<div class="buttons">
						<button type="button" class="btn btn--ghost" onclick={closePlate}>
							Keep the account
						</button>
					</div>
				{:else}
					<form class="form" novalidate onsubmit={deleteAccount}>
						<div class="field">
							<label for="delete-username">Type the username {username} to confirm</label>
							<input
								id="delete-username"
								name="username"
								type="text"
								class="input"
								value={typed}
								readonly={running}
								oninput={onInput}
								autocomplete="off"
								spellcheck="false"
								aria-describedby={ERROR_ID}
								aria-invalid={fieldError ? true : undefined}
							/>
							<p id={ERROR_ID} class="error" aria-live="polite">{fieldError}</p>
						</div>
						<div class="buttons">
							<button type="submit" class="btn btn--ink" aria-busy={running}>
								Delete account permanently
							</button>
							<button type="button" class="btn btn--ghost" disabled={running} onclick={closePlate}>
								Keep the account
							</button>
						</div>
					</form>
				{/if}
			</SettingsPlate>
		</div>
	{/if}
</SettingsCard>

<style lang="postcss">
	@reference "../../../app.css";

	.group-label {
		@apply text-sm font-medium;
		margin-bottom: calc(-1 * var(--spacing-sm));
	}

	.effects {
		@apply flex flex-col text-sm;
		gap: var(--spacing-xs);
		padding-left: 1.25rem;
		list-style: disc;
	}

	.form {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col min-w-0;
		gap: var(--spacing-xs);
	}

	label {
		@apply font-medium text-ink;
		overflow-wrap: anywhere;
	}

	/* One slot for two lines, so a refusal appearing or clearing moves nothing below the field. */
	.error {
		@apply text-sm;
		min-height: 2.5rem;
		color: var(--danger);
	}

	.buttons {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
