<script lang="ts">
	import { Hanko } from '@teamhanko/hanko-elements';
	import { goto } from '$app/navigation';
	import { PUBLIC_HANKO_API_URL } from '$env/static/public';
	import { session } from '$lib/media/utils/session.svelte.js';

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

<button class="logout label" onclick={logout}>Logout</button>

<style lang="postcss">
	@reference "../../../app.css";

	.logout {
		@apply text-ink-muted bg-transparent border-0 p-0 shrink-0 cursor-pointer;
	}

	.logout:hover {
		@apply text-brand;
	}
</style>
