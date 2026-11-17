<script lang="ts">
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Notice from '#lib/components/ui/notice.svelte';
	import {
		AUTH_PROVIDERS,
		providerIcon,
		providerLabel,
		type ConfiguredProviders
	} from '#lib/media/utils/auth-providers.ts';
	import { HEADING_ID, passkeyName, SignInMethods } from '#lib/signInMethods.svelte.ts';

	interface Props {
		providers: ConfiguredProviders;
	}

	let { providers }: Props = $props();

	const methods = new SignInMethods();

	// Until the list loads, every configured provider has its button, disabled; a linked one drops out after.
	const linkable = $derived(
		AUTH_PROVIDERS.filter(
			(p) => providers[p.id] && !methods.accounts.some((a) => a.providerId === p.id)
		)
	);

	function added(value?: Date | string | null, withTime = false) {
		if (!value) return '';
		// The reader's own time zone, in the site's `dd/mm/yyyy` date format.
		const when = new Date(value).toLocaleString('en-GB', {
			dateStyle: 'short',
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

<svelte:window onpageshow={(event) => event.persisted && methods.restored()} />

<section
	id="sign-in-methods"
	class="card methods"
	aria-busy={methods.loading || methods.busy}
	aria-labelledby={HEADING_ID}
>
	<h2 id={HEADING_ID} tabindex="-1">Sign-in methods</h2>

	{#if methods.loadFailed}
		<Notice tone="error">
			The sign-in methods could not be loaded. Reload the page to try again.
		</Notice>
	{:else}
		{#if !methods.loading && methods.onlyMethod}
			<Notice tone="warn" id="last-method-hint">
				This account has one sign-in method. It cannot be removed, and if it is lost the account
				cannot be recovered: MIDB has no email recovery. Add another method first.
			</Notice>
		{/if}

		{#if methods.loading}
			<div class="skeleton" role="status">
				<span class="sr-only">Loading sign-in methods</span>
				<div class="skeleton-row"></div>
				<div class="skeleton-row"></div>
			</div>
		{:else}
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
									>{passkey.backedUp ? 'Synced' : 'This device only'} · {added(
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
		{/if}

		<div class="add">
			<div class="add-actions">
				<button
					type="button"
					class="btn btn--brand"
					aria-busy={methods.running === 'add-passkey'}
					disabled={methods.loading || (methods.busy && methods.running !== 'add-passkey')}
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
						disabled={methods.loading ||
							(methods.busy && methods.running !== `link:${provider.id}`)}
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

<style lang="postcss">
	@reference "../../../app.css";

	.methods {
		@apply flex flex-col;
		gap: var(--spacing-md);
		padding: 24px;
		scroll-margin-top: 5rem;
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
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

	/* Two rows as tall as a loaded row (a 2.5rem button and its padding), so the list arrives in place. */
	.skeleton {
		@apply flex flex-col;
	}

	.skeleton-row {
		@apply border-b border-border;
		height: calc(2.5rem + 2 * var(--spacing-sm) + 1px);
		background: linear-gradient(var(--surface-sunken), var(--surface-sunken)) left center / 40%
			0.75rem no-repeat;
		animation: pulse 1.6s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-row {
			animation: none;
		}
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
