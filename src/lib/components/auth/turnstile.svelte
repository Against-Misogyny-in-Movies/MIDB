<script module lang="ts">
	interface TurnstileApi {
		render(
			container: HTMLElement,
			options: {
				sitekey: string;
				theme: 'auto';
				callback: (token: string) => void;
				'error-callback': () => void;
				'expired-callback': () => void;
				'timeout-callback': () => void;
			}
		): string;
		reset(widgetId: string): void;
		remove(widgetId: string): void;
	}

	declare global {
		interface Window {
			turnstile?: TurnstileApi;
		}
	}

	const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	let loading: Promise<TurnstileApi> | undefined;

	/** Cloudflare's script, added to the page on the first call and shared after. */
	function loadTurnstile(): Promise<TurnstileApi> {
		return (loading ??= new Promise<TurnstileApi>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = SCRIPT_URL;
			script.async = true;
			script.addEventListener('load', () =>
				window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing'))
			);
			script.addEventListener('error', () => reject(new Error('Turnstile failed to load')));
			document.head.appendChild(script);
		}).catch((err: unknown) => {
			// A failed load may be retried by the next mount.
			loading = undefined;
			throw err;
		}));
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		siteKey: string;
		/** Called with a fresh single-use token once the check passes. */
		ontoken: (token: string) => void;
		/** Called when the script cannot load or the check fails; `reset()` tries again. */
		onfail: () => void;
		/** Called when a token expires unused. */
		onexpire?: () => void;
	}

	let { siteKey, ontoken, onfail, onexpire }: Props = $props();

	let container: HTMLDivElement;
	let widgetId: string | undefined;

	/** Asks Cloudflare for a new token; the old one was used or has expired. */
	export function reset(): void {
		if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
	}

	// The script loads here, when the widget mounts, so no other page requests it.
	onMount(() => {
		let removed = false;
		loadTurnstile().then(
			(api) => {
				if (removed) return;
				widgetId = api.render(container, {
					sitekey: siteKey,
					theme: 'auto',
					callback: ontoken,
					'error-callback': onfail,
					'expired-callback': () => onexpire?.(),
					'timeout-callback': () => onexpire?.()
				});
			},
			() => {
				if (!removed) onfail();
			}
		);
		return () => {
			removed = true;
			if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
		};
	});
</script>

<div bind:this={container} class="turnstile"></div>

<style lang="postcss">
	@reference "../../../app.css";

	/* Cloudflare's widget is 300px by 65px; the slot is reserved so it does not shift the page. */
	.turnstile {
		min-height: 65px;
	}
</style>
