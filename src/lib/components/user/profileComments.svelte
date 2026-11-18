<script lang="ts">
	import ProfileCommentRow from '#lib/components/user/profileCommentRow.svelte';
	import ProfileRows from '#lib/components/user/profileRows.svelte';
	import { describeFailure } from '#lib/media/utils/commentApi.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { ProfilePager } from '#lib/media/utils/profilePager.svelte.js';
	import type { ProfileComment, ProfileCommentPage } from '#lib/media/types/profile.ts';

	interface Props {
		username: string;
		/** The first page, from the cached page load. */
		first: ProfileCommentPage;
		/**
		 * Set once the owner's private view has loaded: every row is then the owner's own and gains
		 * Edit and Delete. `replyCounts` is by comment id (`OwnProfile`).
		 */
		own?: { replyCounts: Record<string, number> } | null;
	}

	let { username, first, own = null }: Props = $props();

	const pager = new ProfilePager<ProfileComment, ProfileCommentPage>({
		first: () => ({ items: first.comments, nextCursor: first.nextCursor }),
		path: (cursor) =>
			`/api/users/${encodeURIComponent(username)}/comments?cursor=${encodeURIComponent(cursor)}`,
		read: (page) => ({ items: page.comments, nextCursor: page.nextCursor }),
		key: (comment) => comment.id,
		failure: (status, message) => describeFailure('more', status, message)
	});
	let moreButton: HTMLButtonElement | undefined = $state();

	async function showMore() {
		const firstNew = await pager.showMore();
		await focusAfterUpdate(() =>
			firstNew === null
				? moreButton
				: document.getElementById(`profile-comment-${pager.shown[firstNew].id}`)
		);
	}
</script>

<ProfileRows
	items={pager.shown}
	key={(comment) => comment.id}
	rowId={(comment) => `profile-comment-${comment.id}`}
	empty="No published comments."
>
	{#snippet row(comment)}
		<ProfileCommentRow
			{comment}
			own={own ? { replyCount: own.replyCounts[comment.id] ?? 0 } : null}
		/>
	{/snippet}
</ProfileRows>
{#if pager.shown.length > 0 && pager.nextCursor}
	<div class="more">
		<button
			class="btn btn--ink"
			type="button"
			aria-busy={pager.busy}
			bind:this={moreButton}
			onclick={showMore}
		>
			Show more comments
		</button>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.more {
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
