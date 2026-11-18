<script lang="ts">
	import { accountHref } from '#lib/media/utils/accountHref.ts';
	import { profileHref } from '#lib/media/utils/profileHref.ts';

	interface Props {
		/** The account's opaque id; without one the name is plain text. */
		id: string | null | undefined;
		/** The account's username; without one there is no public profile to offer. */
		username: string | null | undefined;
		/** What the link says; the username, or "Account", when omitted. */
		name?: string;
	}

	let { id, username, name }: Props = $props();

	const label = $derived(name ?? username ?? 'Account');
	const profile = $derived(profileHref(username));
</script>

{#if id}<a class="link name" href={accountHref(id)}>{label}</a>{:else}{label}{/if}{#if profile}<a
		class="profile"
		href={profile}
		aria-label="Public profile of {label}"
		title="Public profile"><i class="ri-user-3-line" aria-hidden="true"></i></a
	>{/if}

<style lang="postcss">
	@reference "../../../app.css";

	/* The public profile sits beside the account's page as a small muted icon, so a name is still one link to the page. */
	.profile {
		@apply inline-flex items-center text-ink-muted no-underline;
		margin-left: 0.25rem;
		vertical-align: -0.1em;
	}

	.profile:hover {
		@apply text-ink;
	}

	/* On a touch screen both links are 44px tall, with 24px between them, so a tap lands on the one meant. */
	@media (pointer: coarse) {
		.name {
			@apply inline-flex items-center;
			min-height: 2.75rem;
		}

		.profile {
			@apply justify-center;
			min-height: 2.75rem;
			min-width: 2.75rem;
			margin-left: 1.5rem;
		}
	}
</style>
