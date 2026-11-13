<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '#lib/auth-client.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';

	interface Props {
		/** `button` is a ghost button (the profile page); `menu` fills a row of the mobile menu. */
		variant?: 'button' | 'menu';
	}

	let { variant = 'button' }: Props = $props();

	// Order matters: the cookie must be gone before /auth and any re-run load sees the request.
	const logout = async () => {
		try {
			await authClient.signOut();
		} catch {
			// Already signed out or unreachable: still drop the local session below.
		}
		session.clear();
		await goto('/auth', { refreshAll: true });
		toasts.success('Signed out.');
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
