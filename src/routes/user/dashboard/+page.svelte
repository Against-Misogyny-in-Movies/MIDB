<script>
	import HankoProfile from '$lib/components/auth/hankoProfile.svelte';
</script>

<div class="dashboard-page">
	<header class="dashboard-header">
		<a href="/user/profile" class="back-link label">← Profile</a>
		<h1 class="display">Account settings</h1>
	</header>

	<HankoProfile />
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.dashboard-page {
		@apply max-w-lg mx-auto py-lg flex flex-col gap-lg;
	}

	.dashboard-header {
		@apply flex flex-col gap-sm;
	}

	.back-link {
		@apply text-ink-muted no-underline text-sm hover:text-brand;
	}
</style>
