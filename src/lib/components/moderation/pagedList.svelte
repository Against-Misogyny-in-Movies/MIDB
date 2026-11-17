<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import type { QueueName, QueuePage } from '#lib/media/types/moderation.ts';
	import { describeStatus } from '#lib/media/utils/commentApi.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { ProfilePager } from '#lib/media/utils/profilePager.svelte.js';

	interface Props {
		/** The first page, from the page load. A reload that replaces it drops the later pages. */
		page: QueuePage<T>;
		/** The list's name at `/api/moderation/queue`. */
		queue: QueueName;
		/** A stable key for a row, so a row on two pages shows once. */
		key: (item: T) => string;
		/** What the list says when it has no rows; also the element that takes the focus when the last row leaves. */
		empty: string;
		/** The empty line's id, for a row's submit to focus; one list per page keeps the default. */
		emptyId?: string;
		/** What the list holds, for the sentence of a failed load: "More {noun} could not be loaded". */
		noun: string;
		row: Snippet<[T]>;
	}

	let { page, queue, key, empty, emptyId = 'moderation-empty', noun, row }: Props = $props();

	const FAILED = $derived(`More ${noun} could not be loaded`);

	const pager = new ProfilePager<T, QueuePage<T>>({
		first: () => page,
		path: (cursor) => `/api/moderation/queue?queue=${queue}&cursor=${encodeURIComponent(cursor)}`,
		read: (next) => next,
		key: (item) => key(item),
		failure: (status) =>
			describeStatus(FAILED, status, {
				forbidden: `${FAILED}. Moderation is open to moderators and administrators only.`,
				badRequest: `${FAILED}. Reload the page.`
			}),
		resetOnReload: true
	});
	let list: HTMLUListElement | undefined = $state();
	let moreButton: HTMLButtonElement | undefined = $state();

	/** Moves the focus to the first row the page added, or back to the button when none was. */
	async function showMore() {
		const firstNew = await pager.showMore();
		await focusAfterUpdate(() =>
			firstNew === null ? moreButton : (list?.children[firstNew] as HTMLElement | undefined)
		);
	}
</script>

{#if pager.shown.length === 0}
	<p class="empty" id={emptyId} tabindex="-1">{empty}</p>
{:else}
	<ul class="card list" bind:this={list}>
		{#each pager.shown as item (key(item))}
			{@render row(item)}
		{/each}
	</ul>
	{#if pager.nextCursor}
		<div class="more">
			<button
				class="btn btn--ink"
				type="button"
				aria-busy={pager.busy}
				bind:this={moreButton}
				onclick={showMore}
			>
				Show more
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.empty {
		@apply text-ink-muted;
	}

	.list {
		@apply flex flex-col list-none p-0 m-0 overflow-hidden;
	}

	.list > :global(li + li) {
		border-top: 1px solid var(--border);
	}

	.more {
		padding-top: var(--spacing-md);
	}
</style>
