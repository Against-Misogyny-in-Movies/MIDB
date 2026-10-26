<script lang="ts">
	import { Hanko } from '@teamhanko/hanko-elements';
	import { goto } from '$app/navigation';
	import { PUBLIC_HANKO_API_URL } from '$env/static/public';
	import { session } from '$lib/media/utils/session.svelte.js';

	interface Props {
		/** `inline` sits in the navbar; `menu` fills a row of the mobile menu. */
		variant?: 'inline' | 'menu';
	}

	let { variant = 'inline' }: Props = $props();

	const hanko = new Hanko(PUBLIC_HANKO_API_URL);

	// Order matters: the cookie must be gone before /auth and any re-run load sees the request.
	const logout = async () => {
		try {
			await hanko.logout();
		} catch {
			// Already signed out or Hanko unreachable: still drop the local session below.
		}
		session.clear();
		await goto('/auth', { invalidateAll: true });
	};
</script>

<button
	class="logout logout--{variant}"
	role={variant === 'menu' ? 'menuitem' : undefined}
	onclick={logout}
>
	Sign out
</button>

<style lang="postcss">
	@reference "../../../app.css";

	.logout {
		@apply bg-transparent border-0 p-0 shrink-0 cursor-pointer whitespace-nowrap text-left;
		font: inherit;
		transition: color 0.15s ease;
	}

	.logout--inline {
		@apply text-sm text-ink-muted;
	}

	.logout--inline:hover {
		@apply text-ink;
	}

	.logout--menu {
		@apply block w-full text-ink px-md py-sm;
	}

	.logout--menu:hover {
		background-color: var(--surface-sunken);
	}

	.logout--menu:focus-visible {
		outline-offset: -2px;
	}
</style>
