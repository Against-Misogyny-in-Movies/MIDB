<script lang="ts">
	import MakeModeratorForm from '#lib/components/moderation/staff/makeModeratorForm.svelte';
	import StaffRow from '#lib/components/moderation/staff/staffRow.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Staff · Moderation · MIDB</title>
</svelte:head>

<div class="page">
	<header>
		<a href="/user/moderation" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Moderation</a
		>
		<h1 class="display">Staff</h1>
	</header>

	<ul class="card row-list" aria-label="Administrators and moderators">
		{#each data.staff as member (member.user.id)}
			<StaffRow {member} meId={data.me.id} />
		{/each}
	</ul>

	<MakeModeratorForm />
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.page {
		@apply flex flex-col mx-auto;
		max-width: 48rem;
		gap: var(--spacing-md);
		padding-block: var(--spacing-xl);
	}

	header {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
		margin-bottom: var(--spacing-sm);
	}

	.back:hover {
		@apply text-ink;
	}

	h1 {
		font-size: 1.875rem;
	}
</style>
