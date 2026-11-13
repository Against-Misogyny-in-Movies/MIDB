<script lang="ts">
	import CommentDate from '#lib/components/comments/commentDate.svelte';
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import { requestJson } from '#lib/media/utils/commentApi.ts';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';
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
			toasts.error('More comments could not be loaded. Try again.');
			return;
		}
		more = [...more, ...reply.data.comments];
		cursor = reply.data.nextCursor;
	}
</script>

{#if shown.length === 0}
	<p class="empty">No published comments.</p>
{:else}
	<ul class="rows">
		{#each shown as comment (comment.id)}
			{@const href = titleHref(comment.title.kind, comment.title.tmdbId)}
			<li>
				<p class="line">
					{#if href}<a class="link title" {href}>{comment.title.name}</a>{:else}<span class="title"
							>{comment.title.name}</span
						>{/if}
					<CommentDate
						class="label"
						href={commentHref(comment.title.kind, comment.title.tmdbId, comment.id)}
						createdAt={comment.createdAt}
					/>
					{#if comment.editedAt}<span class="label">Edited</span>{/if}
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
			</li>
		{/each}
	</ul>
	{#if nextCursor}
		<div class="more">
			<button class="btn btn--ink" type="button" aria-busy={busy} onclick={showMore}>
				Show more comments
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.rows {
		@apply flex flex-col list-none m-0 p-0;
	}

	.rows li {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}

	.line {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.title {
		@apply font-semibold;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.body {
		@apply text-base;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}

	.more {
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
