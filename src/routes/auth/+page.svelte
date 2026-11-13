<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';
	import Notice from '#lib/components/ui/notice.svelte';
	import Turnstile from '#lib/components/auth/turnstile.svelte';
	import { authClient, createCaptchaClient } from '#lib/auth-client.ts';
	import { passkeyErrorMessage, providerErrorMessage } from '#lib/auth-errors.ts';
	import { AUTH_PROVIDERS, type Provider } from '#lib/media/utils/auth-providers.ts';
	import { currentDeviceName } from '#lib/media/utils/deviceName.ts';
	import { DEFAULT_RETURN_PATH, safeReturnPath } from '#lib/media/utils/returnPath.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// A page that sent the reader here passes its path as `?next=`; only a same-origin path counts.
	const afterSignIn = $derived(safeReturnPath(page.url.searchParams.get('next')));
	const errorReturn = $derived(
		afterSignIn === DEFAULT_RETURN_PATH ? '/auth' : `/auth?next=${encodeURIComponent(afterSignIn)}`
	);
	const passkeysSupported = typeof PublicKeyCredential !== 'undefined';
	const providers = $derived(AUTH_PROVIDERS.filter((p) => data.providers[p.id]));

	// The form renders once two things are known, so nothing moves after it appears: whether
	// the browser offers saved passkeys in a field (`autofill`) and whether the reader is
	// already signed in, who is sent on instead.
	let autofill = $state<boolean | null>(null);
	const ready = $derived(autofill !== null && session.status === 'anon');

	let signInBusy = $state(false);
	/** The provider whose sign-in is starting; the browser then leaves for it. */
	let socialBusy = $state<Provider['id'] | null>(null);

	// Sign-up with Turnstile runs in steps: `checking` while the widget works, `ready` once it
	// has a token and the next click may start the passkey prompt (browsers want a fresh click
	// for it), `failed` when the widget or script could not run, and the button then runs the
	// check again.
	type SignUp = 'idle' | 'checking' | 'ready' | 'failed' | 'working';
	let signUp = $state<SignUp>('idle');
	let token: string | null = null;
	/** Whether a token that arrives may start the prompt at once (the click that began the check). */
	let continueOnToken = false;
	let widget = $state<{ reset(): void }>();
	let widgetAttempt = $state(0);

	const captchaOn = PUBLIC_TURNSTILE_SITE_KEY.length > 0;
	const signUpLabel = $derived(
		signUp === 'checking'
			? 'Checking the browser'
			: signUp === 'ready'
				? 'Create the passkey'
				: signUp === 'failed'
					? 'Run the check again'
					: 'Create an account with a passkey'
	);

	// The session store resolves once per page load, so a sign-in made here is read back before
	// the next page renders its navbar.
	async function enter() {
		await session.refresh();
		await goto(afterSignIn);
	}

	async function signInWithPasskey() {
		signInBusy = true;
		const { error } = await authClient.signIn.passkey();
		signInBusy = false;
		if (error) {
			toasts.error(passkeyErrorMessage(error, 'sign-in'));
			return;
		}
		await enter();
	}

	async function signInWithProvider(provider: Provider) {
		socialBusy = provider.id;
		const { error } = await authClient.signIn.social({
			provider: provider.id,
			callbackURL: afterSignIn,
			errorCallbackURL: errorReturn
		});
		if (error) {
			socialBusy = null;
			toasts.error(providerErrorMessage(error.code ?? ''));
		}
	}

	/** Starts a Turnstile check; `after` says whether its token may start the prompt by itself. */
	function runCheck(after: boolean) {
		token = null;
		continueOnToken = after;
		if (signUp === 'failed') widgetAttempt++;
		signUp = 'checking';
	}

	async function createAccount() {
		// A site key means the server wants a token: never ask for the passkey without one.
		if (captchaOn && !token) {
			runCheck(false);
			return;
		}
		signUp = 'working';
		const used = token;
		token = null;
		const client = used ? createCaptchaClient(used) : authClient;
		const { error } = await client.passkey.addPasskey({
			name: currentDeviceName(),
			createSession: true
		});
		if (error) {
			toasts.error(passkeyErrorMessage(error, 'sign-up'));
			// A token is single-use: the next attempt needs a new check, and the reader's next
			// click, not this failure, decides when the prompt opens.
			continueOnToken = false;
			signUp = captchaOn ? 'checking' : 'idle';
			if (captchaOn) widget?.reset();
			return;
		}
		await enter();
	}

	function startSignUp() {
		if (!captchaOn || (signUp === 'ready' && token)) void createAccount();
		else runCheck(true);
	}

	function onToken(value: string) {
		token = value;
		if (continueOnToken && navigator.userActivation?.isActive) void createAccount();
		else signUp = 'ready';
	}

	function onCheckFailed() {
		token = null;
		signUp = 'failed';
	}

	onMount(() => {
		// A provider sign-in that failed redirects back here with `?error=<code>`.
		const code = page.url.searchParams.get('error');
		if (code) toasts.error(providerErrorMessage(code));
		void session.load();
		void (async () => {
			autofill =
				passkeysSupported &&
				(await PublicKeyCredential.isConditionalMediationAvailable?.()) === true;
		})();
	});

	// A signed-in reader has nothing to do here.
	$effect(() => {
		if (session.status === 'user') void goto(afterSignIn, { replace: true });
	});

	// Offers saved passkeys in the field's autofill list, once the field is on the page. A
	// dismissed or replaced request is not an error: the button below reports its own failures.
	let autofillStarted = false;
	$effect(() => {
		if (!ready || !autofill || autofillStarted) return;
		autofillStarted = true;
		void authClient.signIn.passkey({ autoFill: true }).then(({ error }) => {
			if (!error) return enter();
		});
	});
</script>

<svelte:head>
	<title>Sign in | MIDB</title>
</svelte:head>

<h1 class="display">Sign in</h1>
<p class="lead">MIDB stores no passwords.</p>

{#if ready}
	{#if providers.length > 0}
		<div class="group">
			{#each providers as provider (provider.id)}
				<button
					type="button"
					class="btn btn--ink wide"
					aria-busy={socialBusy === provider.id}
					disabled={socialBusy !== null}
					onclick={() => signInWithProvider(provider)}
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
					class="input"
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

		<button
			type="button"
			class="btn btn--ghost wide"
			disabled={!passkeysSupported || signInBusy || signUp === 'working' || signUp === 'checking'}
			aria-busy={signUp === 'working'}
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
				The check against automated sign-ups could not run. A browser extension or the network may
				be blocking it.
			</Notice>
		{/if}
	</div>
{/if}

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
</style>
