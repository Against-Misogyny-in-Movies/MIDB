<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Notice from '#lib/components/ui/notice.svelte';
	import { authClient } from '#lib/auth-client.ts';
	import { passkeyErrorMessage, providerErrorMessage } from '#lib/auth-errors.ts';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	type Provider = 'google' | 'discord';
	const PROVIDERS: { id: Provider; label: string; icon: string }[] = [
		{ id: 'google', label: 'Google', icon: 'ri-google-fill' },
		{ id: 'discord', label: 'Discord', icon: 'ri-discord-fill' }
	];
	const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.label ?? id;
	const providerIcon = (id: string) => PROVIDERS.find((p) => p.id === id)?.icon ?? 'ri-user-line';

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

	let accounts = $state<LinkedAccount[]>([]);
	let passkeys = $state<PasskeyRow[]>([]);
	let loading = $state(true);
	let loadFailed = $state(false);
	let busy = $state(false);

	let error = $state<string | null>(null);
	let done = $state<string | null>(null);
	/** The row with its inline confirm open (`account:<id>` or `passkey:<id>`). */
	let confirming = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let nameDraft = $state('');

	const total = $derived(accounts.length + passkeys.length);
	const onlyMethod = $derived(total <= 1);
	const linkable = $derived(
		PROVIDERS.filter((p) => data.providers[p.id] && !accounts.some((a) => a.providerId === p.id))
	);

	const added = (value?: Date | string | null) =>
		value ? `Added ${new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : '';

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
		if (code) error = providerErrorMessage(code);
		void Promise.all([loadAccounts(), loadPasskeys()]).then(() => (loading = false));
	});

	/** Runs one change, then reloads the list it touched; a refused change shows the server's reason. */
	async function change(
		run: () => Promise<{ error: { message?: string } | null }>,
		success: string,
		fallback: string,
		reload: () => Promise<void>
	) {
		busy = true;
		error = null;
		done = null;
		const { error: failure } = await run();
		if (failure) {
			busy = false;
			error = failure.message || fallback;
			return;
		}
		confirming = null;
		renaming = null;
		done = success;
		await reload();
		busy = false;
	}

	const unlink = (a: LinkedAccount) =>
		change(
			() => authClient.unlinkAccount({ accountId: a.id }),
			`${providerLabel(a.providerId)} removed.`,
			'The account could not be removed. Try again.',
			loadAccounts
		);

	const removePasskey = (p: PasskeyRow) =>
		change(
			() => authClient.passkey.deletePasskey({ id: p.id }),
			'Passkey deleted.',
			'The passkey could not be deleted. Try again.',
			loadPasskeys
		);

	const renamePasskey = (p: PasskeyRow) =>
		change(
			() => authClient.passkey.updatePasskey({ id: p.id, name: nameDraft.trim() }),
			'Passkey renamed.',
			'The passkey could not be renamed. Try again.',
			loadPasskeys
		);

	async function addPasskey() {
		busy = true;
		error = null;
		done = null;
		const { error: failure } = await authClient.passkey.addPasskey({});
		if (failure) {
			busy = false;
			error = passkeyErrorMessage(failure, 'add-passkey');
			return;
		}
		done = 'Passkey added.';
		await loadPasskeys();
		busy = false;
	}

	async function link(provider: Provider) {
		error = null;
		done = null;
		const { error: failure } = await authClient.linkSocial({
			provider,
			callbackURL: '/user/security',
			errorCallbackURL: '/user/security'
		});
		if (failure) error = providerErrorMessage(failure.code ?? '');
	}

	function startRename(p: PasskeyRow) {
		confirming = null;
		renaming = p.id;
		nameDraft = p.name ?? '';
	}
</script>

<svelte:head>
	<title>Sign-in methods | MIDB</title>
</svelte:head>

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Sign-in methods</h1>
	</header>

	{#if error}
		<Notice tone="error">{error}</Notice>
	{/if}
	{#if done}
		<Notice tone="success">{done}</Notice>
	{/if}

	<section class="card methods" aria-busy={loading || busy} aria-labelledby="methods-heading">
		<h2 id="methods-heading">Accounts and passkeys</h2>

		{#if loadFailed}
			<p class="empty">The sign-in methods could not be loaded. Reload the page to try again.</p>
		{:else if loading}
			<p class="empty">Loading…</p>
		{:else}
			{#if onlyMethod}
				<p class="hint">The only sign-in method cannot be removed. Add another one first.</p>
			{/if}
			<ul>
				{#each accounts as account (account.id)}
					<li>
						<div class="row">
							<i class="{providerIcon(account.providerId)} icon" aria-hidden="true"></i>
							<div class="meta">
								<span class="name">{providerLabel(account.providerId)}</span>
								<span class="label">{added(account.createdAt)}</span>
							</div>
							<button
								type="button"
								class="btn btn--ghost"
								disabled={onlyMethod || busy}
								onclick={() => (confirming = `account:${account.id}`)}
							>
								Remove
							</button>
						</div>
						{#if confirming === `account:${account.id}`}
							<div class="confirm">
								<p>
									Remove {providerLabel(account.providerId)}? The account can no longer sign in with
									it.
								</p>
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										disabled={busy}
										onclick={() => unlink(account)}
										>Remove {providerLabel(account.providerId)}</button
									>
									<button type="button" class="btn btn--ghost" onclick={() => (confirming = null)}
										>Keep it</button
									>
								</div>
							</div>
						{/if}
					</li>
				{/each}

				{#each passkeys as passkey (passkey.id)}
					<li>
						<div class="row">
							<i class="ri-fingerprint-line icon" aria-hidden="true"></i>
							<div class="meta">
								<span class="name">{passkey.name || 'Passkey'}</span>
								<span class="label">{added(passkey.createdAt)}</span>
							</div>
							<button
								type="button"
								class="btn btn--ghost"
								disabled={busy}
								onclick={() => startRename(passkey)}
							>
								Rename
							</button>
							<button
								type="button"
								class="btn btn--ghost"
								disabled={onlyMethod || busy}
								onclick={() => {
									renaming = null;
									confirming = `passkey:${passkey.id}`;
								}}
							>
								Delete
							</button>
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
									type="text"
									bind:value={nameDraft}
									maxlength="64"
									autocomplete="off"
									required
								/>
								<div class="actions">
									<button type="submit" class="btn btn--ink" disabled={busy || !nameDraft.trim()}
										>Save name</button
									>
									<button type="button" class="btn btn--ghost" onclick={() => (renaming = null)}
										>Cancel</button
									>
								</div>
							</form>
						{/if}
						{#if confirming === `passkey:${passkey.id}`}
							<div class="confirm">
								<p>
									Delete “{passkey.name || 'Passkey'}”? It can no longer sign in to MIDB. The copy
									on the device stays until it is deleted in the device's passkey settings.
								</p>
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										disabled={busy}
										onclick={() => removePasskey(passkey)}>Delete passkey</button
									>
									<button type="button" class="btn btn--ghost" onclick={() => (confirming = null)}
										>Keep it</button
									>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="add">
				<button type="button" class="btn btn--brand" disabled={busy} onclick={addPasskey}>
					<i class="ri-fingerprint-line" aria-hidden="true"></i>
					Add a passkey
				</button>
				{#each linkable as provider (provider.id)}
					<button
						type="button"
						class="btn btn--ghost"
						disabled={busy}
						onclick={() => link(provider.id)}
					>
						<i class={provider.icon} aria-hidden="true"></i>
						Link {provider.label}
					</button>
				{/each}
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
		margin-bottom: var(--spacing-sm);
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
		@apply flex items-center gap-sm;
		padding-block: var(--spacing-sm);
	}

	.icon {
		@apply text-xl text-ink-muted;
	}

	.meta {
		@apply flex flex-col flex-1 min-w-0;
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
		@apply flex flex-wrap gap-sm;
		padding-top: var(--spacing-sm);
	}

	.add .btn {
		@apply gap-sm;
	}

	input {
		@apply w-full text-ink bg-surface-raised;
		height: 2.75rem;
		padding-inline: 16px;
		border-radius: 12px;
		border: 1px solid var(--border-strong);
		transition: border-color 0.15s ease;
	}

	input:hover {
		border-color: var(--ink-muted);
	}

	input:focus-visible {
		@apply outline-none;
		border-color: var(--brand);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent);
	}
</style>
