<script lang="ts">
	import CommentDate from '#lib/components/comments/commentDate.svelte';
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import ProfileRows from '#lib/components/user/profileRows.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import { describeFailure, requestJson } from '#lib/media/utils/commentApi.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import type { ProfileCommentPage } from '#lib/media/types/profile.ts';

	interface Props {
		username: string;
		/** The first page, from the cached page load. */
		first: ProfileCommentPage;
	}

	let { username, first }: Props = $props();

	/** Pages after the first, appended in place. */
	let more = $state<ProfileCommentPage['comments']>([]);
	let cursor = $state<string | null | undefined>(undefined);
	let busy = $state(false);
	let moreButton: HTMLButtonElement | undefined = $state();

	const shown = $derived.by(() => {
		const known = new Set(first.comments.map((c) => c.id));
		return [...first.comments, ...more.filter((c) => !known.has(c.id))];
	});
	const nextCursor = $derived(cursor === undefined ? first.nextCursor : cursor);

	async function showMore() {
		if (!nextCursor || busy) return;
		busy = true;
		const reply = await requestJson<ProfileCommentPage>(
			(input, init) => fetch(input, init),
			'GET',
			`/api/users/${encodeURIComponent(username)}/comments?cursor=${encodeURIComponent(nextCursor)}`
		);
		busy = false;
		if (!reply.ok) {
			toasts.error(describeFailure('more', reply.status, reply.message));
			await focusAfterUpdate(() => moreButton);
			return;
		}
		const firstNew = reply.data.comments.find((c) => !shown.some((s) => s.id === c.id));
		more = [...more, ...reply.data.comments];
		cursor = reply.data.nextCursor;
		await focusAfterUpdate(() =>
			firstNew ? document.getElementById(`profile-comment-${firstNew.id}`) : moreButton
		);
	}
</script>

<ProfileRows
	items={shown}
	key={(comment) => comment.id}
	rowId={(comment) => `profile-comment-${comment.id}`}
	empty="No published comments."
>
	{#snippet row(comment)}
		<p class="line">
			<ProfileTitleLink
				kind={comment.title.kind}
				tmdbId={comment.title.tmdbId}
				name={comment.title.name}
			/>
			<CommentDate
				class="label"
				href={commentHref(comment.title.kind, comment.title.tmdbId, comment.id)}
				createdAt={comment.createdAt}
			/>
			{#if comment.edited}<span class="label">Edited</span>{/if}
			<span class="label num">Score {comment.score}</span>
		</p>
		{#if comment.inReplyTo}
			<p class="label">
				In reply to <ProfileLink
					username={comment.inReplyTo.username}
					name={comment.inReplyTo.displayName}
				/>
			</p>
		{/if}
		<p class="body">{comment.body}</p>
	{/snippet}
</ProfileRows>
{#if shown.length > 0 && nextCursor}
	<div class="more">
		<button
			class="btn btn--ink"
			type="button"
			aria-busy={busy}
			bind:this={moreButton}
			onclick={showMore}
		>
			Show more comments
		</button>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.line {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.body {
		@apply text-base;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.more {
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
