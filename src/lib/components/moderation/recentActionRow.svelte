<script lang="ts">
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import { enhance } from '$app/forms';
	import type { RecentAction } from '#lib/media/types/moderation.ts';
	import { formatMuteHours } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { toastActionResult } from '#lib/media/utils/rowSubmit.ts';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		entry: RecentAction;
	}

	let { entry }: Props = $props();

	let busy = $state(false);
	let root: HTMLElement | undefined = $state();

	const VERBS: Record<RecentAction['action'], string> = {
		approve: 'approved a comment',
		hide: 'hid a comment',
		reject: 'rejected a comment',
		restore: 'restored a comment',
		dismiss: 'dismissed the reports on a comment',
		mute: 'muted',
		ban: 'banned',
		approve_report: 'counted a community report by',
		reject_report: 'rejected a community report by',
		reject_account_reports: 'rejected every community report by',
		resolve_count_flag: 'resolved Counts look wrong on',
		dismiss_count_flag: 'dismissed Counts look wrong on'
	};
	/** The actions on a title's counts: the title ends the sentence, and the moderation view opens it. */
	const ON_COUNTS = new Set<RecentAction['action']>([
		'approve_report',
		'reject_report',
		'resolve_count_flag',
		'dismiss_count_flag'
	]);
	const FLAG_ACTIONS = new Set<RecentAction['action']>([
		'resolve_count_flag',
		'dismiss_count_flag'
	]);

	/** A hide or a reject can be undone while the comment is still in that state. */
	const restorable = $derived(
		entry.commentId !== null &&
			(entry.action === 'hide' || entry.action === 'reject') &&
			(entry.commentStatus === 'hidden' || entry.commentStatus === 'rejected')
	);
	/** The author changed the text after this action, so the text below is not what was acted on. */
	const editedSince = $derived(
		entry.commentEditedAt !== null && entry.commentEditedAt > entry.createdAt
	);
	/** A comment action links to the title's page, a community-report action to its reports here. */
	const href = $derived(
		!entry.title
			? undefined
			: ON_COUNTS.has(entry.action)
				? `?title=${entry.title.id}`
				: titleHref(entry.title.kind, entry.title.tmdbId)
	);
	/** A comment action also links to the comment itself on its title's page. */
	const commentLink = $derived(
		entry.commentId !== null && entry.title
			? commentHref(entry.title.kind, entry.title.tmdbId, entry.commentId)
			: undefined
	);
	const inline = $derived(FLAG_ACTIONS.has(entry.action));
	const muteLength = $derived(
		entry.muteHours === null ? '' : ` for ${formatMuteHours(entry.muteHours)}`
	);
</script>

{#snippet titleLink(name: string)}
	{#if href}<a class="link" {href}>{name}</a>{:else}{name}{/if}
{/snippet}

<li class="entry" tabindex="-1" bind:this={root}>
	<p class="line">
		<span class="name"
			><ProfileLink
				username={entry.actor?.username}
				name={entry.actor?.displayName ?? 'A removed account'}
			/></span
		>
		{VERBS[entry.action]}{#if entry.targetUser}
			<span class="name"
				><ProfileLink
					username={entry.targetUser.username}
					name={entry.targetUser.displayName}
				/></span
			>{/if}{#if inline && entry.title}{@render titleLink(entry.title.name)}{/if}{muteLength}
		<time class="label" datetime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
	</p>
	{#if entry.title && !inline}
		<p class="label">On {@render titleLink(entry.title.name)}</p>
	{/if}
	{#if entry.commentBody}
		<p class="body">{entry.commentBody}</p>
	{/if}
	{#if editedSince}
		<p class="label">Edited since</p>
	{/if}
	{#if commentLink}
		<a class="chip" href={commentLink}>View comment</a>
	{/if}
	{#if entry.reason}
		<p class="label">Reason: {entry.reason}</p>
	{/if}
	{#if restorable}
		<form
			method="POST"
			action="?/restore"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					await update();
					busy = false;
					toastActionResult(result);
					await focusAfterUpdate(() => root);
				};
			}}
		>
			<input type="hidden" name="id" value={entry.commentId} />
			<button class="btn btn--ink" aria-busy={busy}>Restore comment</button>
		</form>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.entry {
		@apply flex flex-col items-start;
		gap: var(--spacing-xs);
		padding: 14px 20px;
	}

	.line {
		@apply flex flex-wrap items-baseline text-sm;
		gap: var(--spacing-xs);
	}

	.name {
		@apply font-semibold;
	}

	.body {
		@apply line-clamp-2 text-sm text-ink-muted;
		overflow-wrap: anywhere;
	}
</style>
