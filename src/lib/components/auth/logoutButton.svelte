<script lang="ts">
	import { Hanko } from '@teamhanko/hanko-elements';
	import { goto } from '$app/navigation';
	import { PUBLIC_HANKO_API_URL } from '$env/static/public';

	const hanko = new Hanko(PUBLIC_HANKO_API_URL);
	const logout = () => {
		hanko.logout().catch((_) => {
			// handle error
		});
		goto('/auth');
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
