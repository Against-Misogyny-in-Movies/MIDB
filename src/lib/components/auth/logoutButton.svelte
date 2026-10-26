<script lang="ts">
	import { Hanko } from '@teamhanko/hanko-elements';
	import { goto } from '$app/navigation';
	import { PUBLIC_HANKO_API_URL } from '$env/static/public';
	import { session } from '$lib/media/utils/session.svelte.js';

	interface Props {
		/** `button` is a ghost button (the profile page); `menu` fills a row of the mobile menu. */
		variant?: 'button' | 'menu';
	}

	let { variant = 'button' }: Props = $props();

	// Order matters: the cookie must be gone before /auth and any re-run load sees the request.
	// The client is created on click, not with the component: Hanko needs `document`, and this
	// button is server-rendered on /user/profile.
	const logout = async () => {
		try {
			await new Hanko(PUBLIC_HANKO_API_URL).logout();
		} catch {
			// Already signed out or Hanko unreachable: still drop the local session below.
		}
		session.clear();
		await goto('/auth', { invalidateAll: true });
	};
</script>

<button
	class={variant === 'button' ? 'btn btn--ghost' : 'logout'}
	role={variant === 'menu' ? 'menuitem' : undefined}
	onclick={logout}
>
	Sign out
</button>

<style lang="postcss">
	@reference "../../../app.css";

	/* A row of the mobile menu. */
	.logout {
		@apply block w-full bg-transparent border-0 cursor-pointer whitespace-nowrap text-left;
		@apply text-sm font-medium text-ink px-md py-sm;
		font-family: inherit;
		letter-spacing: inherit;
	}

	.logout:hover {
		background-color: var(--surface-sunken);
	}

	.logout:focus-visible {
		outline-offset: -2px;
	}
</style>
