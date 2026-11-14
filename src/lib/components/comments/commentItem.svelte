<script lang="ts">
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import CommentAction from './commentAction.svelte';
	import CommentMenu from './commentMenu.svelte';
	import CommentConfirm from './commentConfirm.svelte';
	import CommentDate from './commentDate.svelte';
	import CommentComposer from './commentComposer.svelte';
	import { unpublishedNote } from '#lib/media/utils/comments.ts';
	import CommentReportForm from './commentReportForm.svelte';
	import { COMMENT_STATUS_LABELS } from '#lib/media/utils/comments.ts';
	import type { ShownComment } from '#lib/media/utils/commentThread.ts';
	import type { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: ShownComment;
		state: CommentsState;
	}

	let { comment, state: comments }: Props = $props();

	/** The one open panel under the comment. */
	let mode = $state<'reply' | 'edit' | 'report' | 'delete' | null>(null);
	let root: HTMLElement | undefined = $state();

	const signedIn = $derived(session.status === 'user');
	const own = $derived(
		session.user !== null && comment.author !== null && comment.author.id === session.user.id
	);
	/** A hidden or deleted comment cannot be edited, and a deleted one cannot be deleted again. */
	const closed = $derived(
		comment.review?.status === 'hidden' || comment.review?.status === 'deleted'
	);
	const vote = $derived(comments.voteOf(comment.id));
	/** A muted account cannot write, edit, delete, vote or report until the mute ends. */
	const muted = $derived(comments.mutedUntil !== null);
	/** Writes wait for the reader's state: until it loads a mute and the existing votes are unknown. */
	const locked = $derived(muted || comments.viewerPhase !== 'ready');
	/** Votes from a new account open at a date: until then the vote group is locked like a mute. */
	const votesOpenAt = $derived(comments.votesOpenAt);
	const voteLocked = $derived(locked || votesOpenAt !== null);
	const votesHint = $derived(votesOpenAt ? `Votes open on ${formatDate(votesOpenAt)}.` : undefined);
	/** Each comment's date is a link to it, so a reader can copy the address. */
	const href = $derived(commentHref(comments.kind, Number(comments.tmdbId), comment.id));
	const scoreId = $derived(`score-${comment.id}`);
	const votesHintId = $derived(`votes-hint-${comment.id}`);
	const canVote = $derived(signedIn && !own && !comment.removed);
	const role = $derived(
		comment.author?.role === 'moderator'
			? 'Moderator'
			: comment.author?.role === 'administrator'
				? 'Administrator'
				: null
	);
	const replyKey = $derived(`reply:${comment.id}`);
	const editKey = $derived(`edit:${comment.id}`);
	const deleteKey = $derived(`delete:${comment.id}`);

	const toggle = (next: NonNullable<typeof mode>) => (mode = mode === next ? null : next);

	/** The less frequent actions, in the comment's menu: edit and delete on the reader's own, report on others'. */
	const menuItems = $derived(
		own
			? [
					...(closed
						? []
						: [{ label: 'Edit', expanded: mode === 'edit', onselect: () => toggle('edit') }]),
					...(comment.review?.status === 'deleted'
						? []
						: [{ label: 'Delete', expanded: mode === 'delete', onselect: () => toggle('delete') }])
				]
			: signedIn && !comment.review
				? [{ label: 'Report', expanded: mode === 'report', onselect: () => toggle('report') }]
				: []
	);

	/** The comments next to this one, in the order focus falls back to when this one leaves the list. */
	function neighbourIds(): string[] {
		const all = [...document.querySelectorAll<HTMLElement>('article[id^="comment-"]')];
		const at = root ? all.indexOf(root) : -1;
		return [all[at + 1]?.id, all[at - 1]?.id].filter((id): id is string => Boolean(id));
	}

	/**
	 * Closes the panel without acting, and puts the focus back on what opened it: Reply, or the
	 * menu button for an edit, a report or a delete (their menu items left the page with the menu).
	 */
	function cancelPanel(): void {
		const opener = mode === 'reply' ? '[data-action="reply"]' : '.more button';
		mode = null;
		void focusAfterUpdate(() => root?.querySelector<HTMLElement>(opener) ?? root);
	}

	/** Closes the panel after it did its work, and puts the focus on the comment it acted on. */
	async function closeAndFocus(): Promise<void> {
		mode = null;
		await focusAfterUpdate(() => root);
	}

	async function saveEdit(body: string): Promise<boolean> {
		const ok = await comments.edit(comment.id, body);
		if (ok) await closeAndFocus();
		return ok;
	}

	async function sendReply(body: string): Promise<boolean> {
		const ok = await comments.post(body, comment.id);
		if (ok) await closeAndFocus();
		return ok;
	}

	/**
	 * Deletes the comment. It stays as a placeholder while it has replies, so the focus goes to
	 * it; otherwise it leaves the list, and the focus goes to the next comment, the previous one,
	 * or the list itself.
	 */
	async function remove(): Promise<void> {
		const neighbours = neighbourIds();
		const list = root?.closest<HTMLElement>('[data-comment-list]');
		if (!(await comments.remove(comment.id))) return;
		mode = null;
		await focusAfterUpdate(
			() =>
				(comment.removed ? root : undefined) ??
				neighbours.map((id) => document.getElementById(id)).find((el) => el !== null) ??
				list
		);
	}
</script>

<article
	class="comment"
	class:comment--linked={comments.highlightId === comment.id}
	id="comment-{comment.id}"
	tabindex="-1"
	bind:this={root}
>
	{#if comment.removed}
		<p class="removed">This comment was removed.</p>
	{:else}
		<header class="meta">
			<Avatar avatarKey={comment.author?.avatarKey} size={28} />
			<span class="name"
				><ProfileLink
					username={comment.author?.username}
					name={comment.author?.displayName ?? 'Account'}
				/></span
			>
			{#if role}<Badge tone="brand">{role}</Badge>{/if}
			<CommentDate class="date" short {href} createdAt={comment.createdAt} />
			{#if comment.editedAt}<span class="edited">Edited</span>{/if}
			{#if comment.review}
				<Badge tone={commentStatusTone(comment.review.status)}>
					{COMMENT_STATUS_LABELS[comment.review.status]}
				</Badge>
			{/if}
			{#if menuItems.length > 0}
				<span class="more">
					<CommentMenu
						label="More actions on the comment by {comment.author?.displayName ?? 'Account'}"
						items={menuItems}
						disabled={locked}
					/>
				</span>
			{/if}
		</header>

		{#if comment.inReplyTo}
			<p class="label">
				In reply to <ProfileLink
					username={comment.inReplyTo.username}
					name={comment.inReplyTo.displayName}
				/>
			</p>
		{/if}

		{#if mode === 'edit'}
			<CommentComposer
				label="Edit comment"
				submitLabel="Save"
				initial={comment.body ?? ''}
				busy={comments.busy[editKey]}
				error={comments.errors[editKey]}
				hint="Saving runs moderation again."
				nested
				autofocus
				onsubmit={saveEdit}
				oncancel={cancelPanel}
			/>
		{:else}
			<p class="body">{comment.body}</p>
		{/if}

		{#if comment.review}
			<p class="label">{unpublishedNote(comment.review.status, comment.review.reason)}</p>
		{/if}
	{/if}

	{#if !comment.removed && !comment.review && (canVote || signedIn || comment.score !== 0)}
		<div class="actions">
			{#if canVote}
				<div
					class="votes"
					role="group"
					aria-label="Vote on this comment"
					aria-describedby={votesHint ? votesHintId : undefined}
					title={votesHint}
				>
					{#if votesHint}<span class="sr-only" id={votesHintId}>{votesHint}</span>{/if}
					<CommentAction
						icon
						label="Upvote"
						describedby={scoreId}
						pressed={vote === 1}
						disabled={voteLocked}
						onclick={() => comments.vote(comment.id, 1)}
					>
						<i class="ri-arrow-up-line" aria-hidden="true"></i>
					</CommentAction>
					<span class="score" id={scoreId}><span class="sr-only">Score</span> {comment.score}</span>
					<CommentAction
						icon
						label="Downvote"
						describedby={scoreId}
						pressed={vote === -1}
						disabled={voteLocked}
						onclick={() => comments.vote(comment.id, -1)}
					>
						<i class="ri-arrow-down-line" aria-hidden="true"></i>
					</CommentAction>
				</div>
			{:else}
				<span class="score score--alone">Score {comment.score}</span>
			{/if}

			{#if signedIn}
				<CommentAction
					data="reply"
					disabled={locked}
					expanded={mode === 'reply'}
					onclick={() => toggle('reply')}
					><i class="ri-reply-line" aria-hidden="true"></i>Reply</CommentAction
				>
			{/if}
		</div>
	{/if}

	{#if !comment.removed}
		{#if mode === 'reply'}
			<CommentComposer
				label="Reply to {comment.author?.displayName ?? 'this comment'}"
				submitLabel="Reply"
				busy={comments.busy[replyKey]}
				error={comments.errors[replyKey]}
				nested
				autofocus
				onsubmit={sendReply}
				oncancel={cancelPanel}
			/>
		{/if}
		{#if mode === 'report'}
			<CommentReportForm
				commentId={comment.id}
				state={comments}
				onclose={cancelPanel}
				onsent={closeAndFocus}
			/>
		{/if}
		{#if mode === 'delete'}
			<CommentConfirm
				message="Delete this comment? Other readers no longer see its text, and it cannot be restored.{comment.replyCount >
				0
					? ' Replies stay under a placeholder.'
					: ''}"
				confirmLabel="Delete comment"
				cancelLabel="Keep comment"
				busy={comments.busy[deleteKey]}
				onconfirm={remove}
				oncancel={cancelPanel}
			/>
		{/if}
	{/if}
</article>

<style lang="postcss">
	@reference "../../../app.css";

	.comment {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding-block: var(--spacing-sm);
		scroll-margin-top: 5rem;
		border-radius: 8px;
		outline: 1px solid transparent;
		outline-offset: var(--spacing-xs);
		transition:
			background-color 0.15s ease,
			box-shadow 0.15s ease,
			outline-color 0.15s ease;
	}

	/* The comment a link points at: the wash, and a 1px brand outline for readers who miss the tint. */
	.comment--linked {
		background-color: var(--brand-wash);
		box-shadow: 0 0 0 var(--spacing-xs) var(--brand-wash);
		outline-color: var(--brand);
	}

	@media (prefers-reduced-motion: reduce) {
		.comment {
			transition: none;
		}
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	/* The name and the date read as text in the row; they show they are links on hover. */
	.name {
		@apply font-semibold;
	}

	.name :global(a),
	.meta :global(.date) {
		color: inherit;
		text-decoration-color: transparent;
	}

	.name :global(a:hover),
	.meta :global(.date:hover) {
		text-decoration-color: currentColor;
	}

	.meta :global(.date),
	.edited {
		@apply text-ink-muted;
	}

	/* The menu sits at the row's end, so the actions it holds never move the name. */
	.more {
		margin-left: auto;
	}

	.body {
		@apply text-base;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.removed {
		@apply text-sm text-ink-muted;
	}

	.actions {
		@apply flex flex-wrap items-center;
		min-height: 2rem;
		gap: var(--spacing-xs);
		/* The vote arrows line up with the text above them, not with their own padding. */
		margin-left: calc(-1 * var(--spacing-xs));
	}

	.actions :global(.ri-reply-line) {
		margin-right: var(--spacing-xs);
	}

	.votes {
		@apply inline-flex items-center;
	}

	.score {
		@apply text-sm font-medium text-center;
		min-width: 4ch;
		font-variant-numeric: tabular-nums;
	}

	/* A score with no vote arrows: a reader who cannot vote, or the reader's own comment. */
	.score--alone {
		@apply text-ink-muted font-normal text-left;
		padding-inline: var(--spacing-xs) var(--spacing-sm);
	}
</style>
