<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import LogoutButton from '#lib/components/auth/logoutButton.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import { AUTH_PROVIDERS, providerIcon, providerLabel } from '#lib/media/utils/auth-providers.ts';
	import { HEADING_ID, passkeyName, SignInMethods } from '#lib/signInMethods.svelte.ts';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const methods = new SignInMethods();

	const linkable = $derived(
		AUTH_PROVIDERS.filter(
			(p) => data.providers[p.id] && !methods.accounts.some((a) => a.providerId === p.id)
		)
	);

	function added(value?: Date | string | null, withTime = false) {
		if (!value) return '';
		const when = new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			...(withTime && { timeStyle: 'short' })
		});
		return `Added ${when}`;
	}

	onMount(() => {
		const params = page.url.searchParams;
		void methods.load(params.get('error'), params.get('linked'));
		// The result is shown once: a reload of the page does not show it again.
		if (params.has('error') || params.has('linked')) {
			const url = new URL(page.url.href);
			url.searchParams.delete('error');
			url.searchParams.delete('linked');
			replaceState(url, page.state);
		}
	});
</script>

<svelte:head>
	<title>Settings · MIDB</title>
</svelte:head>

<svelte:window onpageshow={(event) => event.persisted && methods.restored()} />

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Settings</h1>
	</header>

	<section class="card plain" aria-labelledby="email-heading">
		<h2 id="email-heading">Email</h2>
		{#if data.email}
			<p class="email">{data.email}</p>
			<p class="hint">Not shown on the profile or on comments.</p>
		{:else}
			<p class="hint">This account has no email: it signs in with a passkey.</p>
		{/if}
	</section>

	<section
		class="card methods"
		aria-busy={methods.loading || methods.busy}
		aria-labelledby={HEADING_ID}
	>
		<h2 id={HEADING_ID} tabindex="-1">Accounts and passkeys</h2>

		{#if methods.loadFailed}
			<Notice tone="error">
				The sign-in methods could not be loaded. Reload the page to try again.
			</Notice>
		{:else if methods.loading}
			<p class="empty">Loading…</p>
		{:else}
			{#if methods.onlyMethod}
				<p id="last-method-hint" class="hint">
					The only sign-in method cannot be removed. Add another one first.
				</p>
			{/if}
			<ul>
				{#each methods.accounts as account (account.id)}
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
									disabled={methods.onlyMethod || methods.busy}
									aria-describedby={methods.onlyMethod ? 'last-method-hint' : undefined}
									onclick={() => methods.openConfirm(key)}
								>
									Remove
								</button>
							</div>
						</div>
						{#if methods.confirming === key}
							<div class="confirm">
								<p id="confirm-{key}" tabindex="-1">
									Remove {providerLabel(account.providerId)}? The account can no longer sign in with
									it.
								</p>
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										aria-busy={methods.running === `unlink:${account.id}`}
										disabled={methods.busy && methods.running !== `unlink:${account.id}`}
										onclick={() => methods.unlink(account)}
										>Remove {providerLabel(account.providerId)}</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => methods.closePlate(`remove-account-${account.id}`)}
										>Keep it</button
									>
								</div>
							</div>
						{/if}
					</li>
				{/each}

				{#each methods.passkeys as passkey (passkey.id)}
					{@const key = `passkey:${passkey.id}`}
					<li>
						<div class="row">
							<i class="ri-fingerprint-line icon" aria-hidden="true"></i>
							<div class="meta">
								<span class="name">{passkeyName(passkey)}</span>
								<span class="label"
									>{added(
										passkey.createdAt,
										methods.duplicateNames.includes(passkeyName(passkey))
									)}</span
								>
							</div>
							<div class="row-actions">
								<button
									type="button"
									id="rename-passkey-{passkey.id}"
									class="btn btn--ghost"
									disabled={methods.busy}
									onclick={() => methods.openRename(passkey)}
								>
									Rename
								</button>
								<button
									type="button"
									id="delete-passkey-{passkey.id}"
									class="btn btn--ghost"
									disabled={methods.onlyMethod || methods.busy}
									aria-describedby={methods.onlyMethod ? 'last-method-hint' : undefined}
									onclick={() => methods.openConfirm(key)}
								>
									Delete
								</button>
							</div>
						</div>
						{#if methods.renaming === passkey.id}
							<form
								class="confirm"
								onsubmit={(e) => {
									e.preventDefault();
									void methods.renamePasskey(passkey);
								}}
							>
								<label for="rename-{passkey.id}" class="label">Passkey name</label>
								<input
									id="rename-{passkey.id}"
									class="input"
									type="text"
									bind:value={methods.nameDraft}
									maxlength="64"
									autocomplete="off"
									required
								/>
								<div class="actions">
									<button
										type="submit"
										class="btn btn--ink"
										aria-busy={methods.running === `rename:${passkey.id}`}
										disabled={!methods.nameDraft.trim() ||
											(methods.busy && methods.running !== `rename:${passkey.id}`)}
										>Save name</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => methods.closePlate(`rename-passkey-${passkey.id}`)}
										>Cancel</button
									>
								</div>
							</form>
						{:else if methods.confirming === key}
							<div class="confirm">
								<p id="confirm-{key}" tabindex="-1">
									Delete “{passkeyName(passkey)}”? It can no longer sign in to MIDB. The copy on the
									device stays until it is deleted in the device's passkey settings.
								</p>
								<div class="actions">
									<button
										type="button"
										class="btn btn--ink"
										aria-busy={methods.running === `delete:${passkey.id}`}
										disabled={methods.busy && methods.running !== `delete:${passkey.id}`}
										onclick={() => methods.removePasskey(passkey)}>Delete passkey</button
									>
									<button
										type="button"
										class="btn btn--ghost"
										onclick={() => methods.closePlate(`delete-passkey-${passkey.id}`)}
										>Keep it</button
									>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="add">
				<div class="add-actions">
					<button
						type="button"
						class="btn btn--brand"
						aria-busy={methods.running === 'add-passkey'}
						disabled={methods.busy && methods.running !== 'add-passkey'}
						onclick={() => methods.addPasskey()}
					>
						<i class="ri-fingerprint-line" aria-hidden="true"></i>
						Add a passkey
					</button>
					{#each linkable as provider (provider.id)}
						<button
							type="button"
							class="btn btn--ghost"
							aria-busy={methods.running === `link:${provider.id}`}
							disabled={methods.busy && methods.running !== `link:${provider.id}`}
							onclick={() => methods.link(provider)}
						>
							<i class={provider.icon} aria-hidden="true"></i>
							Link {provider.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</section>

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

	.plain {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: 24px;
	}

	.email {
		overflow-wrap: anywhere;
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
