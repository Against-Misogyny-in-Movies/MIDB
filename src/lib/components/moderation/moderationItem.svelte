<script lang="ts">
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import { enhance } from '$app/forms';
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import ReportRowShell from '#lib/components/moderation/reportRowShell.svelte';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import type { ModerationItem } from '#lib/media/types/moderation.ts';
	import {
		COMMENT_STATUS_LABELS,
		REPORT_REASON_LABELS,
		categoryLabel
	} from '#lib/media/utils/comments.ts';
	import { canActOn, canEndMute, canLiftBan } from '#lib/media/utils/canActOn.ts';
	import { editedAtValue } from '#lib/media/utils/editedAtValue.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';
	import { recordLine } from '#lib/media/utils/reporterRecord.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone, severityTone } from '#lib/media/utils/tones.ts';

	interface Props {
		item: ModerationItem;
		/** The acting staff member; `canActOn` decides which controls the author's account allows. */
		me: { id: string; role: string };
		/**
		 * The row above already shows the author, the title, the status and the start of the text (the
		 * table's detail), so the panel leaves them out and shows the rest.
		 */
		inRow?: boolean;
		/** The element that takes the focus when an action takes this item off the page and no neighbour can (default: the empty-state line). */
		fallbackId?: string | (() => string | string[]);
		/** Whether a severe comment's text is shown; the list keeps it so the row and the panel agree. Without it the panel keeps its own. */
		revealed?: boolean;
		onreveal?: (show: boolean) => void;
		class?: string;
		id?: string;
		/** The element, as the shell takes it. */
		as?: 'li' | 'div';
		/** The panel element, so a key handler can focus it. */
		root?: HTMLElement;
	}

	let {
		item,
		me,
		inRow = false,
		fallbackId = 'moderation-empty',
		revealed,
		onreveal,
		class: className,
		id,
		as,
		root = $bindable()
	}: Props = $props();

	type Panel = 'hide' | 'reject' | 'mute' | 'ban' | 'unmute' | 'unban';
	let panel = $state<Panel | null>(null);
	/** The action whose form is in flight, so its button reads as busy and the others wait. */
	let busy = $state<string | null>(null);
	/** The buttons that open a plate, so Cancel and Escape can give the focus back. */
	let triggers = $state<Partial<Record<Panel, HTMLButtonElement>>>({});
	let ownRevealed = $state(false);

	const { comment, author } = $derived(item);
	const canModerate = $derived(canActOn(me, author));
	const canRestrict = $derived(canActOn(me, author, 'restrict'));
	/** A hidden or rejected comment offers Restore; a pending or published one offers Hide and Reject. */
	const restorable = $derived(comment.status === 'hidden' || comment.status === 'rejected');
	const removable = $derived(comment.status === 'pending' || comment.status === 'published');
	/** A moderator ends only a mute a moderator set; an administrator ends any, and only they lift a ban. */
	const endable = $derived(canEndMute(me, author, item.authorMutedByModerator));
	const liftable = $derived(canLiftBan(me, author));
	const href = $derived(titleHref(item.title.kind, item.title.tmdbId));
	const permalink = $derived(commentHref(item.title.kind, item.title.tmdbId, comment.id));
	const SOURCES: Record<string, string> = {
		ai: 'Held by the automatic check',
		blocklist: 'Matched the blocklist',
		reports: 'Sent back by reports'
	};
	const heldBy = $derived(comment.moderationSource ? SOURCES[comment.moderationSource] : null);
	/** The author's standing and figures, the ones the account's page shows, in one line. */
	const standing = $derived(
		[
			`${item.authorCommentCount} ${item.authorCommentCount === 1 ? 'comment' : 'comments'} in all`,
			`${item.authorHiddenOrRejected} hidden or rejected`,
			`${item.authorOpenReportsAgainst} open ${item.authorOpenReportsAgainst === 1 ? 'report' : 'reports'} against`,
			`Joined ${formatDate(item.authorJoinedAt)}`,
			item.authorBanned
				? 'Banned'
				: item.authorMutedUntil
					? `Muted until ${formatDate(item.authorMutedUntil)}`
					: null,
			heldBy
		]
			.filter((fact) => fact !== null)
			.join(' · ')
	);
	/** A severe comment's text stays out of sight until a moderator asks for it, unless the setting is off. */
	const collapsible = $derived(item.severe && moderationPrefs.collapseSevere);
	const shown = $derived(revealed ?? ownRevealed);
	const collapsed = $derived(collapsible && !shown);

	function show(next: boolean) {
		if (onreveal) onreveal(next);
		else ownRevealed = next;
	}

	/**
	 * A form action. When the comment leaves the queue its row is gone, so the focus goes to the
	 * next row, the previous one, or the empty-state line; a row that stays takes it back.
	 */
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (panel = null),
		() => (typeof fallbackId === 'function' ? fallbackId() : fallbackId)
	);

	/** Whether single-key shortcuts act, so the buttons they press say so (`aria-keyshortcuts`). */
	const keys = $derived(moderationPrefs.shortcuts);
	const toggle = (next: Panel) => (panel = panel === next ? null : next);
</script>

<ReportRowShell
	bind:root
	class={className}
	id={id ?? `comment-${comment.id}`}
	{as}
	headless={inRow}
	readOnly={!canModerate && !canRestrict ? 'An administrator decides on this comment.' : undefined}
>
	{#snippet name()}
		{#if !inRow}
			<span class="who"
				><Avatar avatarKey={author.avatarKey} size={24} /><AccountLink
					id={author.id}
					username={author.username}
					name={author.displayName}
				/></span
			>
		{/if}
	{/snippet}
	{#snippet meta()}
		{#if !inRow}
			{#if author.role !== 'user'}
				<Badge tone="brand">{author.role === 'moderator' ? 'Moderator' : 'Administrator'}</Badge>
			{/if}
			<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
			{#if permalink}<CommentLink href={permalink} />{/if}
			{#if comment.editedAt}<span class="label">Edited</span>{/if}
			<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge
			>
			{#if item.severity !== null && item.severity > 0}
				<Badge tone={severityTone(item.severity)}>Severity {item.severity}</Badge>
			{/if}
		{/if}
	{/snippet}

	{#if !inRow}
		<p class="label">
			{comment.parentId ? 'Reply on' : 'On'}
			{#if href}<a class="link" {href}>{item.title.name}</a>{:else}{item.title.name}{/if}
		</p>
	{/if}

	<p class="label">{standing}</p>

	{#if item.parent}
		<p class="context">
			In reply to <strong
				><AccountLink
					id={item.parent.authorId}
					username={item.parent.authorUsername}
					name={item.parent.author}
				/></strong
			>{#if item.parent.excerpt}: {item.parent.excerpt}{:else}, a deleted comment{/if}
		</p>
	{/if}
	{#if comment.replyCount > 0}
		<p class="label">
			{comment.replyCount}
			{comment.replyCount === 1 ? 'reply' : 'replies'}
		</p>
	{/if}

	{#if collapsed}
		<div class="collapsed">
			<p>
				The automatic check rated this comment severity {item.severity} of 3. Its text stays hidden until
				shown.
			</p>
		</div>
	{:else}
		<p class="body">{comment.body}</p>
	{/if}
	{#if collapsible}
		<div class="action-row">
			<button
				class="btn btn--ghost"
				type="button"
				aria-expanded={!collapsed}
				data-action="reveal"
				aria-keyshortcuts={keys && collapsed ? 's' : undefined}
				onclick={() => show(collapsed)}
			>
				{collapsed ? 'Show comment' : 'Collapse comment'}
			</button>
		</div>
	{/if}

	{#if item.aiCategories.length > 0}
		<ul class="tags" aria-label="Categories from the automatic check">
			{#each item.aiCategories as category (category)}
				<li><Badge tone="neutral">{categoryLabel(category)}</Badge></li>
			{/each}
		</ul>
	{/if}

	{#if item.reports.length > 0}
		<section class="reports" aria-label="Open reports">
			<p class="label">
				{item.reports.length}
				{item.reports.length === 1 ? 'open report' : 'open reports'}
			</p>
			<ul>
				{#each item.reports as report (report.createdAt + report.reason)}
					<li>
						<Badge tone="neutral">{REPORT_REASON_LABELS[report.reason]}</Badge>
						<span class="label"
							>Reported by <AccountLink
								id={report.reporterId}
								username={report.reporter}
								name={report.reporter ?? 'An account'}
							/></span
						>
						<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
						<span class="label record">{recordLine(report.record)}</span>
						{#if report.note}<span class="note">{report.note}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#snippet actions()}
		{#if canModerate && comment.status === 'pending'}
			<form method="POST" action="?/approve" use:enhance={submit('approve')}>
				<input type="hidden" name="id" value={comment.id} />
				<input type="hidden" name="editedAt" value={editedAtValue(comment.editedAt)} />
				<button
					class="btn btn--ink"
					data-action="approve"
					aria-keyshortcuts={keys ? 'a' : undefined}
					aria-busy={busy === 'approve'}
					disabled={busy !== null && busy !== 'approve'}
				>
					Approve
				</button>
			</form>
		{/if}
		{#if canModerate && item.reports.length > 0}
			<form method="POST" action="?/dismiss" use:enhance={submit('dismiss')}>
				<input type="hidden" name="id" value={comment.id} />
				<input type="hidden" name="editedAt" value={editedAtValue(comment.editedAt)} />
				<button
					class="btn btn--ink"
					data-action="dismiss"
					aria-keyshortcuts={keys ? 'd' : undefined}
					aria-busy={busy === 'dismiss'}
					disabled={busy !== null && busy !== 'dismiss'}
				>
					Dismiss reports
				</button>
			</form>
		{/if}
		{#if canModerate && restorable}
			<form method="POST" action="?/restore" use:enhance={submit('restore')}>
				<input type="hidden" name="id" value={comment.id} />
				<input type="hidden" name="editedAt" value={editedAtValue(comment.editedAt)} />
				<button
					class="btn btn--ink"
					data-action="restore"
					aria-keyshortcuts={keys ? 'r' : undefined}
					aria-busy={busy === 'restore'}
					disabled={busy !== null && busy !== 'restore'}
				>
					Restore comment
				</button>
			</form>
		{/if}
		{#if canModerate && removable}
			<button
				class="btn btn--ghost"
				type="button"
				data-action="hide"
				aria-keyshortcuts={keys ? 'h' : undefined}
				aria-expanded={panel === 'hide'}
				bind:this={triggers.hide}
				onclick={() => toggle('hide')}>Hide</button
			>
			<button
				class="btn btn--ghost"
				type="button"
				data-action="reject"
				aria-keyshortcuts={keys ? 'x' : undefined}
				aria-expanded={panel === 'reject'}
				bind:this={triggers.reject}
				onclick={() => toggle('reject')}>Reject</button
			>
		{/if}
		{#if canRestrict}
			{#if item.authorBanned}
				{#if liftable}
					<button
						class="btn btn--ghost"
						type="button"
						aria-expanded={panel === 'unban'}
						bind:this={triggers.unban}
						onclick={() => toggle('unban')}>Lift ban</button
					>
				{/if}
			{:else}
				{#if !item.authorMutedUntil}
					<button
						class="btn btn--ghost"
						type="button"
						aria-expanded={panel === 'mute'}
						bind:this={triggers.mute}
						onclick={() => toggle('mute')}>Mute account</button
					>
				{:else if endable}
					<button
						class="btn btn--ghost"
						type="button"
						aria-expanded={panel === 'unmute'}
						bind:this={triggers.unmute}
						onclick={() => toggle('unmute')}>End mute</button
					>
				{:else}
					<p class="label">Only an administrator can end this mute.</p>
				{/if}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'ban'}
					bind:this={triggers.ban}
					onclick={() => toggle('ban')}>Ban account</button
				>
			{/if}
		{/if}
	{/snippet}

	{#snippet footer()}
		{#if panel}
			<ModerationConfirm
				kind={panel}
				name={author.displayName}
				fields={{ id: comment.id, userId: author.id }}
				{busy}
				{submit}
				oncancel={() => (panel = null)}
				opener={() => (panel ? triggers[panel] : undefined)}
			/>
		{/if}
	{/snippet}
</ReportRowShell>

<style lang="postcss">
	@reference "../../../app.css";

	.who {
		@apply inline-flex items-center;
		gap: var(--spacing-xs);
	}

	/* The parent's start: a 1px hairline, so the quote reads as another voice. */
	.context {
		@apply text-sm text-ink-muted;
		border-left: 1px solid var(--border-strong);
		padding-left: var(--spacing-sm);
		overflow-wrap: anywhere;
	}

	.body {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.collapsed {
		@apply text-sm text-ink-muted;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: 12px;
		background-color: var(--surface-sunken);
	}

	.tags,
	.reports ul {
		@apply flex flex-wrap list-none m-0 p-0;
		gap: var(--spacing-xs);
	}

	.reports {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.reports ul {
		@apply flex-col;
	}

	.reports li {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	/* The reporter's record has its own line, apart from the report's date. */
	.record {
		flex-basis: 100%;
	}

	.note {
		overflow-wrap: anywhere;
	}
</style>
