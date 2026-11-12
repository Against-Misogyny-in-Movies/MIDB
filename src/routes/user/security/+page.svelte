<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import Notice from '#lib/components/ui/notice.svelte';
	import { authClient } from '#lib/auth-client.ts';
	import {
		methodErrorMessage,
		passkeyErrorMessage,
		providerErrorMessage,
		type AuthClientError
	} from '#lib/auth-errors.ts';
	import {
		AUTH_PROVIDERS,
		providerIcon,
		providerLabel,
		type Provider
	} from '#lib/media/utils/auth-providers.ts';
	import { currentDeviceName, DEFAULT_PASSKEY_NAME } from '#lib/media/utils/deviceName.ts';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	interface LinkedAccount {
		id: string;
		providerId: string;
		createdAt: Date | string;
	}
	interface PasskeyRow {
		id: string;
		name?: string | null;
		createdAt?: Date | string | null;
	}
	/** A result shown beside the action it reports on: a row (`account:<id>`, `passkey:<id>`) or the add buttons. */
	interface Result {
		at: string;
		tone: 'error' | 'success';
		text: string;
	}

	let accounts = $state<LinkedAccount[]>([]);
	let passkeys = $state<PasskeyRow[]>([]);
	let loading = $state(true);
	let loadFailed = $state(false);
	let busy = $state(false);

	let notice = $state<Result | null>(null);
	/** The row with its inline confirm open (`account:<id>` or `passkey:<id>`). */
	let confirming = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let nameDraft = $state('');
	let heading = $state<HTMLHeadingElement>();

	const total = $derived(accounts.length + passkeys.length);
	const onlyMethod = $derived(total <= 1);
	const linkable = $derived(
		AUTH_PROVIDERS.filter(
			(p) => data.providers[p.id] && !accounts.some((a) => a.providerId === p.id)
		)
	);

	const passkeyName = (p: PasskeyRow) => p.name || DEFAULT_PASSKEY_NAME;
	// Two passkeys with the same name are told apart by the time they were added.
	const duplicateNames = $derived(
		new Set(passkeys.map(passkeyName).filter((name, i, names) => names.indexOf(name) !== i))
	);

	function added(value?: Date | string | null, withTime = false) {
		if (!value) return '';
		const when = new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			...(withTime && { timeStyle: 'short' })
		});
		return `Added ${when}`;
	}

	const say = (at: string, tone: Result['tone'], text: string) => (notice = { at, tone, text });

	// Each list has its own load, so a change refetches only what it touched: every call counts
	// against the auth rate limit.
	async function loadAccounts() {
		const { data: rows, error: failure } = await authClient.listAccounts();
		if (failure) loadFailed = true;
		else accounts = rows ?? [];
	}

	async function loadPasskeys() {
		const { data: rows, error: failure } = await authClient.passkey.listUserPasskeys();
		if (failure) loadFailed = true;
		else passkeys = rows ?? [];
	}

	onMount(() => {
		const code = page.url.searchParams.get('error');
		if (code) say('add', 'error', providerErrorMessage(code));
		void Promise.all([loadAccounts(), loadPasskeys()]).then(() => (loading = false));
	});

	/** Moves focus to an element by id, or to the list heading when that element is gone. */
	async function focusOn(id: string) {
		await tick();
		(document.getElementById(id) ?? heading)?.focus();
	}

	/** Closes a confirm or rename plate and hands focus back to the button that opened it. */
	function closePlate(triggerId: string) {
		confirming = null;
		renaming = null;
		notice = null;
		void focusOn(triggerId);
	}

	function openConfirm(key: string) {
		notice = null;
		renaming = null;
		confirming = key;
		void focusOn(`confirm-${key}`);
	}

	function openRename(p: PasskeyRow) {
		notice = null;
		confirming = null;
		renaming = p.id;
		nameDraft = passkeyName(p);
		void tick().then(() => {
			const input = document.getElementById(`rename-${p.id}`) as HTMLInputElement | null;
			input?.focus();
			input?.select();
		});
	}

	interface Change {
		/** Where a failure shows: the open plate of the row. */
		at: string;
		run: () => Promise<{ error: AuthClientError | null }>;
		success: string;
		/** Where the success shows: the row, or the add buttons when the row is gone. */
		successAt: string;
		fallback: string;
		reload: () => Promise<void>;
		/** What takes focus afterwards: the trigger, or the heading when it is gone. */
		focusId: string;
	}

	/** Runs one change, then reloads the list it touched. */
	async function change(c: Change) {
		busy = true;
		notice = null;
		const { error: failure } = await c.run();
		if (failure) {
			busy = false;
			say(c.at, 'error', methodErrorMessage(failure, c.fallback));
			return;
		}
		confirming = null;
		renaming = null;
		say(c.successAt, 'success', c.success);
		await c.reload();
		busy = false;
		void focusOn(c.focusId);
	}

	const unlink = (a: LinkedAccount) =>
		change({
			at: `account:${a.id}`,
			run: () => authClient.unlinkAccount({ accountId: a.id }),
			success: `${providerLabel(a.providerId)} removed.`,
			successAt: 'add',
			fallback: 'The account could not be removed. Try again.',
			reload: loadAccounts,
			focusId: 'methods-heading'
		});

	const removePasskey = (p: PasskeyRow) =>
		change({
			at: `passkey:${p.id}`,
			run: () => authClient.passkey.deletePasskey({ id: p.id }),
			success: 'Passkey deleted.',
			successAt: 'add',
			fallback: 'The passkey could not be deleted. Try again.',
			reload: loadPasskeys,
			focusId: 'methods-heading'
		});

	const renamePasskey = (p: PasskeyRow) =>
		change({
			at: `passkey:${p.id}`,
			run: () => authClient.passkey.updatePasskey({ id: p.id, name: nameDraft.trim() }),
			success: 'Passkey renamed.',
			successAt: `passkey:${p.id}`,
			fallback: 'The passkey could not be renamed. Try again.',
			reload: loadPasskeys,
			focusId: `rename-passkey-${p.id}`
		});

	async function addPasskey() {
		busy = true;
		notice = null;
		const { error: failure } = await authClient.passkey.addPasskey({ name: currentDeviceName() });
		if (failure) {
			busy = false;
			say('add', 'error', passkeyErrorMessage(failure, 'add-passkey'));
			return;
		}
		say('add', 'success', 'Passkey added.');
		await loadPasskeys();
		busy = false;
	}

	async function link(provider: Provider) {
		notice = null;
		const { error: failure } = await authClient.linkSocial({
			provider: provider.id,
			callbackURL: '/user/security',
			errorCallbackURL: '/user/security'
		});
		if (failure) say('add', 'error', providerErrorMessage(failure.code ?? ''));
	}
</script>

<svelte:head>
	<title>Sign-in methods | MIDB</title>
</svelte:head>

{#snippet result(at: string)}
	{#if notice?.at === at}
		<Notice tone={notice.tone}>{notice.text}</Notice>
	{/if}
{/snippet}

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Sign-in methods</h1>
	</header>

	<section class="card methods" aria-busy={loading || busy} aria-labelledby="methods-heading">
		<h2 id="methods-heading" tabindex="-1" bind:this={heading}>Accounts and passkeys</h2>

		{#if loadFailed}
			<Notice tone="error">
				The sign-in methods could not be loaded. Reload the page to try again.
			</Notice>
		{:else if loading}
			<p class="empty">Loading…</p>
		{:else}
			{#if onlyMethod}
				<p id="last-method-hint" class="hint">
					The only sign-in method cannot be removed. Add another one first.
				</p>
			{/if}
			<ul>
				{#each accounts as account (account.id)}
					{@const key = `account:${account.id}`}
					<li>
						<div class="row">
							<i class="{providerIcon(account.providerId)} icon" aria-hidden="true"></i>
							<div class="meta">
								<span class="name">{providerLabel(account.providerId)}</span>
								<span class="label">{added(account.createdAt)}</span>
							</div>
							<div class="row-actions">
								<button
									type="button"
									id="remove-account-{account.id}"
									class="btn btn--ghost"
									disabled={onlyMethod || busy}
									aria-describedby={onlyMethod ? 'last-method-hint' : undefined}
									onclick={() => openConfirm(key)}
								>
									Remove
								</button>
							</div>
						</div>
						{#if confirming === key}
							<div class="confirm">
								<p id="confirm-{key}" tabindex="-1">
									Remove {providerLabel(account.providerId)}? The account can no longer sign in with
									it.
								</p>
								{@render result(key)}
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										disabled={busy}
										onclick={() => unlink(account)}
										>Remove {providerLabel(account.providerId)}</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => closePlate(`remove-account-${account.id}`)}>Keep it</button
									>
								</div>
							</div>
						{:else}
							{@render result(key)}
						{/if}
					</li>
				{/each}

				{#each passkeys as passkey (passkey.id)}
					{@const key = `passkey:${passkey.id}`}
					<li>
						<div class="row">
							<i class="ri-fingerprint-line icon" aria-hidden="true"></i>
							<div class="meta">
								<span class="name">{passkeyName(passkey)}</span>
								<span class="label"
									>{added(passkey.createdAt, duplicateNames.has(passkeyName(passkey)))}</span
								>
							</div>
							<div class="row-actions">
								<button
									type="button"
									id="rename-passkey-{passkey.id}"
									class="btn btn--ghost"
									disabled={busy}
									onclick={() => openRename(passkey)}
								>
									Rename
								</button>
								<button
									type="button"
									id="delete-passkey-{passkey.id}"
									class="btn btn--ghost"
									disabled={onlyMethod || busy}
									aria-describedby={onlyMethod ? 'last-method-hint' : undefined}
									onclick={() => openConfirm(key)}
								>
									Delete
								</button>
							</div>
						</div>
						{#if renaming === passkey.id}
							<form
								class="confirm"
								onsubmit={(e) => {
									e.preventDefault();
									void renamePasskey(passkey);
								}}
							>
								<label for="rename-{passkey.id}" class="label">Passkey name</label>
								<input
									id="rename-{passkey.id}"
									class="input"
									type="text"
									bind:value={nameDraft}
									maxlength="64"
									autocomplete="off"
									required
								/>
								{@render result(key)}
								<div class="actions">
									<button type="submit" class="btn btn--ink" disabled={busy || !nameDraft.trim()}
										>Save name</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => closePlate(`rename-passkey-${passkey.id}`)}>Cancel</button
									>
								</div>
							</form>
						{:else if confirming === key}
							<div class="confirm">
								<p id="confirm-{key}" tabindex="-1">
									Delete “{passkeyName(passkey)}”? It can no longer sign in to MIDB. The copy on the
									device stays until it is deleted in the device's passkey settings.
								</p>
								{@render result(key)}
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										disabled={busy}
										onclick={() => removePasskey(passkey)}>Delete passkey</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => closePlate(`delete-passkey-${passkey.id}`)}>Keep it</button
									>
								</div>
							</div>
						{:else}
							{@render result(key)}
						{/if}
					</li>
				{/each}
			</ul>

			<div class="add">
				<div class="add-actions">
					<button type="button" class="btn btn--brand" disabled={busy} onclick={addPasskey}>
						<i class="ri-fingerprint-line" aria-hidden="true"></i>
						Add a passkey
					</button>
					{#each linkable as provider (provider.id)}
						<button
							type="button"
							class="btn btn--ghost"
							disabled={busy}
							onclick={() => link(provider)}
						>
							<i class={provider.icon} aria-hidden="true"></i>
							Link {provider.label}
						</button>
					{/each}
				</div>
				{@render result('add')}
			</div>
		{/if}
	</section>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.account-page {
		@apply flex flex-col mx-auto;
		max-width: 36rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
		min-height: 2.75rem;
	}

	.back:hover {
		@apply text-ink;
	}

	h1 {
		font-size: 1.875rem;
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
	}

	.methods {
		@apply flex flex-col;
		gap: var(--spacing-md);
		padding: 24px;
	}

	.hint,
	.empty {
		@apply text-sm text-ink-muted;
	}

	ul {
		@apply m-0 p-0 list-none;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.row {
		@apply flex flex-wrap items-center gap-sm;
		padding-block: var(--spacing-sm);
	}

	.row-actions {
		@apply flex gap-sm;
	}

	.icon {
		@apply text-xl text-ink-muted;
	}

	.meta {
		@apply flex flex-col min-w-0;
		flex: 1 1 8rem;
	}

	.name {
		@apply font-medium truncate;
	}

	.confirm {
		@apply flex flex-col gap-sm text-sm;
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-sm);
		border-radius: 12px;
		background-color: var(--surface-sunken);
	}

	.actions {
		@apply flex flex-wrap gap-sm;
	}

	.add {
		@apply flex flex-col gap-sm;
		padding-top: var(--spacing-sm);
	}

	.add-actions {
		@apply flex flex-wrap gap-sm;
	}

	.add .btn {
		@apply gap-sm;
	}

	h2:focus-visible,
	.confirm p:focus-visible {
		outline-offset: 2px;
	}
</style>
