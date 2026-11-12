<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';
	import Notice from '#lib/components/ui/notice.svelte';
	import Turnstile from '#lib/components/auth/turnstile.svelte';
	import { authClient, createCaptchaClient } from '#lib/auth-client.ts';
	import { passkeyErrorMessage, providerErrorMessage } from '#lib/auth-errors.ts';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const AFTER_SIGN_IN = '/user/profile';
	const passkeysSupported = typeof PublicKeyCredential !== 'undefined';
	const providers = $derived(
		[
			{ id: 'google', label: 'Google', icon: 'ri-google-fill', on: data.providers.google },
			{ id: 'discord', label: 'Discord', icon: 'ri-discord-fill', on: data.providers.discord }
		].filter((p) => p.on)
	);

	// A provider sign-in that failed redirects back here with `?error=<code>`.
	const providerError = $derived.by(() => {
		const code = page.url.searchParams.get('error');
		return code ? providerErrorMessage(code) : null;
	});

	let autofill = $state(false);
	let signInBusy = $state(false);
	let signInError = $state<string | null>(null);

	// Sign-up with Turnstile runs in steps: `checking` while the widget works, `ready` once it
	// has a token and the next click may start the passkey prompt (browsers want a fresh click
	// for it), `failed` when the widget or script could not run.
	type SignUp = 'idle' | 'checking' | 'ready' | 'failed' | 'working';
	let signUp = $state<SignUp>('idle');
	let signUpError = $state<string | null>(null);
	let token: string | null = null;
	let widget = $state<{ reset(): void }>();
	let widgetAttempt = $state(0);

	const captchaOn = PUBLIC_TURNSTILE_SITE_KEY.length > 0;
	const signUpLabel = $derived(
		signUp === 'checking'
			? 'Checking the browser'
			: signUp === 'ready'
				? 'Create the passkey'
				: 'Create an account with a passkey'
	);

	async function enter() {
		await goto(AFTER_SIGN_IN);
	}

	async function signInWithPasskey() {
		signInBusy = true;
		signInError = null;
		const { error } = await authClient.signIn.passkey();
		signInBusy = false;
		if (error) {
			signInError = passkeyErrorMessage(error, 'sign-in');
			return;
		}
		await enter();
	}

	async function createAccount() {
		signUp = 'working';
		signUpError = null;
		const client = token ? createCaptchaClient(token) : authClient;
		const { error } = await client.passkey.addPasskey({ createSession: true });
		token = null;
		if (error) {
			signUpError = passkeyErrorMessage(error, 'sign-up');
			// A token is single-use: the next attempt needs a new check.
			signUp = captchaOn ? 'checking' : 'idle';
			if (captchaOn) widget?.reset();
			return;
		}
		await enter();
	}

	function startSignUp() {
		signUpError = null;
		if (signUp === 'idle' && captchaOn) {
			signUp = 'checking';
		} else {
			void createAccount();
		}
	}

	function onToken(value: string) {
		token = value;
		// The click that opened the check may still count; if so, carry on without another.
		if (navigator.userActivation?.isActive) void createAccount();
		else signUp = 'ready';
	}

	function onCheckFailed() {
		token = null;
		signUp = 'failed';
	}

	function retryCheck() {
		widgetAttempt++;
		signUp = 'checking';
	}

	onMount(() => {
		if (!passkeysSupported) return;
		void (async () => {
			if (!(await PublicKeyCredential.isConditionalMediationAvailable?.())) return;
			autofill = true;
			await tick();
			// Offers saved passkeys in the field's autofill list. A dismissed or replaced request
			// is not an error: the button below reports its own failures.
			const { error } = await authClient.signIn.passkey({ autoFill: true });
			if (!error) await enter();
		})();
	});
</script>

<svelte:head>
	<title>Sign in | MIDB</title>
</svelte:head>

<h1 class="display">Sign in</h1>
<p class="lead">Sign in with a passkey, Google or Discord. MIDB stores no passwords.</p>

{#if providerError}
	<Notice tone="error">{providerError}</Notice>
{/if}

{#if providers.length > 0}
	<div class="group">
		{#each providers as provider (provider.id)}
			<button
				type="button"
				class="btn btn--ink wide"
				onclick={async () => {
					const { error } = await authClient.signIn.social({
						provider: provider.id as 'google' | 'discord',
						callbackURL: AFTER_SIGN_IN,
						errorCallbackURL: '/auth'
					});
					if (error) signInError = providerErrorMessage(error.code ?? '');
				}}
			>
				<i class={provider.icon} aria-hidden="true"></i>
				Continue with {provider.label}
			</button>
		{/each}
	</div>
	<p class="or" aria-hidden="true"><span>or</span></p>
{/if}

<div class="group">
	{#if !passkeysSupported}
		<Notice tone="error">
			This browser does not support passkeys.{providers.length > 0
				? ' Use Google or Discord instead.'
				: ''}
		</Notice>
	{/if}

	{#if autofill}
		<div class="field">
			<label for="passkey-autofill" class="label">Saved passkey</label>
			<input
				id="passkey-autofill"
				name="passkey-autofill"
				type="text"
				autocomplete="username webauthn"
				placeholder="Select a saved passkey"
			/>
		</div>
	{/if}

	<button
		type="button"
		class="btn btn--brand wide"
		disabled={!passkeysSupported || signInBusy || signUp === 'working'}
		aria-busy={signInBusy}
		onclick={signInWithPasskey}
	>
		<i class="ri-fingerprint-line" aria-hidden="true"></i>
		Sign in with a passkey
	</button>
	{#if signInError}
		<Notice tone="error">{signInError}</Notice>
	{/if}

	<button
		type="button"
		class="btn btn--ghost wide"
		disabled={!passkeysSupported || signInBusy || signUp === 'working' || signUp === 'checking'}
		aria-busy={signUp === 'checking' || signUp === 'working'}
		onclick={startSignUp}
	>
		{signUpLabel}
	</button>

	{#if captchaOn && signUp !== 'idle' && signUp !== 'failed'}
		{#key widgetAttempt}
			<Turnstile
				bind:this={widget}
				siteKey={PUBLIC_TURNSTILE_SITE_KEY}
				ontoken={onToken}
				onfail={onCheckFailed}
				onexpire={() => {
					token = null;
					if (signUp === 'ready') signUp = 'checking';
				}}
			/>
		{/key}
	{/if}
	{#if signUp === 'failed'}
		<Notice tone="error">
			The check against automated sign-ups could not run.
			<button type="button" class="link retry" onclick={retryCheck}>Try again</button>
		</Notice>
	{/if}
	{#if signUpError}
		<Notice tone="error">{signUpError}</Notice>
	{/if}
</div>

<style lang="postcss">
	@reference "../../app.css";

	h1 {
		font-size: 1.875rem;
	}

	.lead {
		@apply text-ink-muted;
		margin-block: var(--spacing-sm) var(--spacing-lg);
	}

	.group {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.wide {
		@apply w-full gap-sm;
		height: 2.75rem;
	}

	.or {
		@apply flex items-center gap-md text-sm text-ink-muted;
		margin-block: var(--spacing-lg);
	}

	.or::before,
	.or::after {
		content: '';
		flex: 1;
		border-top: 1px solid var(--border);
	}

	.field {
		@apply flex flex-col gap-xs;
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

	.retry {
		@apply bg-transparent border-0 p-0 cursor-pointer;
		font: inherit;
	}
</style>
