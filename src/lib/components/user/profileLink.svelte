<script lang="ts">
	import { profileHref } from '#lib/media/utils/profileHref.ts';

	interface Props {
		/** The account's username; without one there is no profile and the name is plain text. */
		username: string | null | undefined;
		/** What the link says; the username when omitted. */
		name?: string;
	}

	let { username, name }: Props = $props();

	const href = $derived(profileHref(username));
</script>

{#if href}<a class="link" {href}>{name ?? username}</a>{:else}{name ?? username ?? 'Account'}{/if}
