<script lang="ts">
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import { enhance } from '$app/forms';
	import type { RecentAction } from '#lib/media/types/moderation.ts';
	import { MODERATION_RULE_LABELS, formatMuteHours } from '#lib/media/utils/comments.ts';
	import { editedAtValue } from '#lib/media/utils/editedAtValue.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { canEndMute, canLiftBan, canReopenFlag } from '#lib/media/utils/canActOn.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		entry: RecentAction;
		/** The acting staff member: their role decides which reversals the row offers (`canEndMute`, `canLiftBan`, `canReopenFlag`). */
		me: { id: string; role: string };
	}

	let { entry, me }: Props = $props();

	let busy = $state<string | null>(null);
	let panel = $state<'unmute' | 'unban' | null>(null);
	let triggers = $state<Partial<Record<'unmute' | 'unban', HTMLButtonElement>>>({});
	let root: HTMLElement | undefined = $state();

	/** What a row says for each action. An action this build does not know reads as a plain label. */
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
		dismiss_count_flag: 'dismissed Counts look wrong on',
		reopen_flag: 're-opened Counts look wrong on',
		unmute: 'ended the mute of',
		unban: 'lifted the ban on',
		set_role: 'changed the role of',
		note: 'added a note on'
	};
	/** The actions on a title's counts: the title ends the sentence, and the moderation view opens it. */
	const ON_COUNTS = new Set<RecentAction['action']>([
		'approve_report',
		'reject_report',
		'resolve_count_flag',
		'dismiss_count_flag',
		'reopen_flag'
	]);
	const FLAG_ACTIONS = new Set<RecentAction['action']>([
		'resolve_count_flag',
		'dismiss_count_flag',
		'reopen_flag'
	]);

	/** A flag row that names the flag's reporter reads "from <name> on <title>". */
	const flagFrom = $derived(FLAG_ACTIONS.has(entry.action) && entry.targetUser !== null);
	/** A role change stores the new role as its reason: "made <name> a moderator", "removed the moderator role from <name>". */
	const roleChange = $derived(
		entry.action === 'set_role' && (entry.reason === 'moderator' || entry.reason === 'user')
			? entry.reason
			: null
	);
	const verb = $derived(
		roleChange === 'moderator'
			? 'made'
			: roleChange === 'user'
				? 'removed the moderator role from'
				: ((VERBS as Record<string, string | undefined>)[entry.action] ?? 'acted on').replace(
						/ on$/,
						flagFrom ? ' from' : ' on'
					)
	);
	/** The latest hide or reject of a comment can be undone while the comment is still in that state. */
	const restorable = $derived(
		entry.commentId !== null &&
			(entry.action === 'hide' || entry.action === 'reject') &&
			entry.latestForComment &&
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
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (panel = null)
	);
	/** A mute still in force, for whoever may end it (`canEndMute`). */
	const endable = $derived(
		entry.action === 'mute' &&
			entry.inForce !== null &&
			entry.targetUser !== null &&
			canEndMute(me, entry.targetUser, entry.inForce.byModerator)
	);
	/** A ban still in force, for whoever may lift it (`canLiftBan`). */
	const liftable = $derived(
		entry.action === 'ban' &&
			entry.inForce !== null &&
			entry.targetUser !== null &&
			canLiftBan(me, entry.targetUser)
	);
	/** A closed flag, for whoever may re-open it (`canReopenFlag`). */
	const reopenable = $derived(
		entry.flag !== null &&
			entry.flag.status !== 'open' &&
			entry.targetUser !== null &&
			canReopenFlag(me, entry.targetUser, entry.flag.closedByAdministrator)
	);
	/** What an undone action is called in "Undoes the …". */
	const UNDONE: Partial<Record<RecentAction['action'], string>> = {
		mute: 'mute',
		ban: 'ban',
		hide: 'hide',
		reject: 'rejection',
		resolve_count_flag: 'resolution',
		dismiss_count_flag: 'dismissal'
	};
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
			><AccountLink
				id={entry.actor?.id}
				username={entry.actor?.username}
				name={entry.actor?.displayName ?? 'A removed account'}
			/></span
		>
		{verb}{#if entry.targetUser}
			<span class="name"
				><AccountLink
					id={entry.targetUser.id}
					username={entry.targetUser.username}
					name={entry.targetUser.displayName}
				/></span
			>{/if}{#if inline && entry.title}{flagFrom ? ' on ' : ''}{@render titleLink(
				entry.title.name
			)}{/if}{roleChange === 'moderator' ? ' a moderator' : muteLength}
		<time class="label" datetime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
		{#if commentLink}<CommentLink href={commentLink} />{/if}
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
	{#if entry.reverses}
		<p class="label">
			Undoes the {UNDONE[entry.reverses.action]} by {entry.reverses.actor ?? 'a removed account'}
			on {formatDate(entry.reverses.createdAt)}.
		</p>
	{/if}
	{#if entry.rule}
		<p class="label">Rule: {MODERATION_RULE_LABELS[entry.rule]}</p>
	{/if}
	{#if entry.reason && !roleChange}
		<p class="label">Note: {entry.reason}</p>
	{/if}
	{#if endable || liftable || reopenable}
		<div class="reversals action-row">
			{#if endable}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'unmute'}
					bind:this={triggers.unmute}
					onclick={() => (panel = panel === 'unmute' ? null : 'unmute')}>End mute</button
				>
			{/if}
			{#if liftable}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'unban'}
					bind:this={triggers.unban}
					onclick={() => (panel = panel === 'unban' ? null : 'unban')}>Lift ban</button
				>
			{/if}
			{#if reopenable && entry.flag}
				<form method="POST" action="?/reopenFlag" use:enhance={submit('reopenFlag')}>
					<input type="hidden" name="id" value={entry.flag.id} />
					<button
						class="btn btn--ghost"
						aria-busy={busy === 'reopenFlag'}
						disabled={busy !== null && busy !== 'reopenFlag'}>Re-open</button
					>
				</form>
			{/if}
		</div>
		{#if panel && entry.targetUser}
			<ModerationConfirm
				kind={panel}
				name={entry.targetUser.displayName}
				fields={{ userId: entry.targetUser.id }}
				{busy}
				{submit}
				oncancel={() => (panel = null)}
				opener={() => (panel ? triggers[panel] : undefined)}
			/>
		{/if}
	{/if}
	{#if restorable}
		<form method="POST" action="?/restore" use:enhance={submit('restore')}>
			<input type="hidden" name="id" value={entry.commentId} />
			<input type="hidden" name="editedAt" value={editedAtValue(entry.commentEditedAt)} />
			<button
				class="btn btn--ink"
				aria-busy={busy === 'restore'}
				disabled={busy !== null && busy !== 'restore'}
			>
				Restore comment
			</button>
		</form>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.entry {
		@apply flex flex-col items-start;
		gap: var(--spacing-xs);
		padding: 14px 20px;
		scroll-margin-top: 5rem;
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
