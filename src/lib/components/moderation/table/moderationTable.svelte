<script lang="ts">
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import CommentDate from '#lib/components/comments/commentDate.svelte';
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ModerationTableRow } from '#lib/media/types/moderation.ts';
	import {
		COMMENT_STATUS_LABELS,
		REPORT_REASON_LABELS,
		categoryLabel
	} from '#lib/media/utils/comments.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';
	import { TABLE_FOCUS } from '#lib/media/utils/tableChips.ts';
	import { commentStatusTone, severityTone } from '#lib/media/utils/tones.ts';

	interface Props {
		rows: ModerationTableRow[];
		me: { id: string; role: string };
		/** The ids of the rows ticked for a bulk action. */
		selected: string[];
	}

	let { rows, me, selected = $bindable() }: Props = $props();

	/** The row whose detail is open: the full comment with every action. */
	let openId = $state<string | null>(null);

	const COLUMNS = 10;

	const reasons = (row: ModerationTableRow) => [
		...new Set(row.reports.map((report) => REPORT_REASON_LABELS[report.reason]))
	];
</script>

<!-- The focus lands here when an action takes its row off the page and no neighbour can take it. -->
<div class="card" id={TABLE_FOCUS.card} tabindex="-1">
	{#if rows.length === 0}
		<p class="empty">No comments match these filters.</p>
	{:else}
		{#if rows.some((row) => !canActOn(me, row.author))}
			<p id="not-selectable" class="sr-only">
				An administrator decides on comments by moderators and administrators, so these are not
				selectable.
			</p>
		{/if}
		<!-- The stacked layout below `lg` sets `display: block`, which drops the table semantics unless the roles are explicit. -->
		<!-- svelte-ignore a11y_no_redundant_roles -->
		<table role="table">
			<caption class="sr-only">
				{rows.length}
				{rows.length === 1 ? 'comment' : 'comments'} on this page, with the automatic check, open reports
				and latest scan of each
			</caption>
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<thead role="rowgroup">
				<!-- svelte-ignore a11y_no_redundant_roles -->
				<tr role="row">
					<th role="columnheader" scope="col" class="select"><span class="sr-only">Select</span></th
					>
					<th role="columnheader" scope="col" class="comment">Comment</th>
					<th role="columnheader" scope="col" class="author">Author</th>
					<th role="columnheader" scope="col" class="title">Title</th>
					<th role="columnheader" scope="col">Status</th>
					<th role="columnheader" scope="col">Automatic check</th>
					<th role="columnheader" scope="col">Reports</th>
					<th role="columnheader" scope="col" class="scan">Scan</th>
					<th role="columnheader" scope="col">Posted</th>
					<th role="columnheader" scope="col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<!-- svelte-ignore a11y_no_redundant_roles -->
			<tbody role="rowgroup">
				{#each rows as row (row.comment.id)}
					{@const id = row.comment.id}
					{@const href = titleHref(row.title.kind, row.title.tmdbId)}
					{@const permalink = commentHref(row.title.kind, row.title.tmdbId, id)}
					{@const open = openId === id}
					<!-- svelte-ignore a11y_no_redundant_roles -->
					<tr class="row" role="row" data-open={open || undefined}>
						<td class="select" role="cell">
							<label class="pick">
								<input
									type="checkbox"
									value={id}
									bind:group={selected}
									disabled={!canActOn(me, row.author)}
									aria-label="Select the comment by {row.author.displayName} on {row.title.name}"
									aria-describedby={canActOn(me, row.author) ? undefined : 'not-selectable'}
								/>
							</label>
						</td>
						<td class="comment" role="cell" data-label="Comment">
							<p class="clamp body">{row.comment.body}</p>
						</td>
						<td class="author" role="cell" data-label="Author">
							<span class="name"
								><ProfileLink username={row.author.username} name={row.author.displayName} /></span
							>
							{#if row.author.role !== 'user'}
								<Badge tone="brand">
									{row.author.role === 'moderator' ? 'Moderator' : 'Administrator'}
								</Badge>
							{/if}
						</td>
						<td class="title" role="cell" data-label="Title">
							<span class="clamp">
								{#if href}<a class="link" {href}>{row.title.name}</a>{:else}{row.title.name}{/if}
							</span>
						</td>
						<td role="cell" data-label="Status">
							<Badge tone={commentStatusTone(row.comment.status)}>
								{COMMENT_STATUS_LABELS[row.comment.status]}
							</Badge>
						</td>
						<td role="cell" data-label="Automatic check">
							<div class="stack">
								{#if row.aiFailure}
									<span class="label">Check failed</span>
								{:else if row.severity === null}
									<span class="label">Not checked</span>
								{:else if row.severity === 0 && row.aiCategories.length === 0}
									<span class="label">Nothing found</span>
								{:else}
									{#if row.severity > 0}
										{#if row.severity >= 2}
											<Badge tone={severityTone(row.severity)}>Severity {row.severity}</Badge>
										{:else}
											<span class="label">Severity {row.severity}</span>
										{/if}
									{/if}
									{#each row.aiCategories as category (category)}
										<Badge tone="neutral">{categoryLabel(category)}</Badge>
									{/each}
								{/if}
							</div>
						</td>
						<td role="cell" data-label="Reports">
							{#if row.reports.length > 0}
								<div class="stack">
									<span class="num count">{row.reports.length} open</span>
									<span class="label">{reasons(row).join(', ')}</span>
								</div>
							{:else}
								<span class="label">None</span>
							{/if}
						</td>
						<td class="scan" role="cell" data-label="Scan">
							{#if row.latestLabel}
								<div class="stack">
									<Badge tone={row.latestLabel.matched ? 'mid' : 'neutral'}>
										{row.latestLabel.matched ? 'Matched' : 'No match'}
									</Badge>
									<span class="label clamp">{row.latestLabel.concern}</span>
								</div>
							{:else}
								<span class="label">Not scanned</span>
							{/if}
						</td>
						<td role="cell" data-label="Posted">
							<CommentDate class="num" href={permalink} createdAt={row.comment.createdAt} />
						</td>
						<td class="actions" role="cell">
							<button
								class="chip"
								type="button"
								aria-expanded={open}
								aria-controls={open ? `detail-${id}` : undefined}
								aria-label="{open ? 'Close' : 'Review'} the comment by {row.author.displayName}"
								onclick={() => (openId = open ? null : id)}
							>
								{open ? 'Close' : 'Review'}
							</button>
						</td>
					</tr>
					{#if open}
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<tr class="detail" role="row" id="detail-{id}">
							<td role="cell" colspan={COLUMNS}>
								{#if row.latestLabel}
									<p class="scan-note label">
										Latest scan for “{row.latestLabel.concern}”: {row.latestLabel.matched
											? 'matched'
											: 'no match'}. {row.latestLabel.reason}
										{#if row.latestLabel.categories.length > 0}
											({row.latestLabel.categories.map(categoryLabel).join(', ')})
										{/if}
									</p>
								{/if}
								<ul class="item">
									<ModerationItemRow item={row} {me} fallbackId={TABLE_FOCUS.card} />
								</ul>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.card {
		/* `clip`, not `hidden`: it rounds the corners without making a scroll box the header would stick in. */
		overflow: clip;
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-lg) var(--spacing-md);
	}

	table {
		@apply w-full text-sm border-collapse;
	}

	th,
	td {
		@apply text-left align-top;
		padding: var(--spacing-sm);
		border-bottom: 1px solid var(--border);
	}

	th {
		@apply font-medium text-ink-muted;
		position: sticky;
		top: 5rem;
		z-index: 1;
		background-color: var(--surface-raised);
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.select {
		width: 2.5rem;
		padding: 0;
	}

	/* The label fills the cell, so the whole cell is the target. */
	.pick {
		@apply flex items-center justify-center cursor-pointer;
		min-width: 2.5rem;
		min-height: 2.25rem;
	}

	.pick input {
		@apply cursor-pointer;
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand);
	}

	.author {
		min-width: 5rem;
	}

	.title {
		min-width: 6rem;
	}

	.scan {
		min-width: 6rem;
	}

	.comment {
		min-width: 8rem;
		width: 100%;
	}

	.row[data-open] > td {
		background-color: var(--surface-sunken);
	}

	.body {
		overflow-wrap: anywhere;
	}

	.clamp {
		@apply line-clamp-2;
		overflow-wrap: anywhere;
	}

	.name {
		@apply font-semibold;
		overflow-wrap: anywhere;
	}

	.stack {
		@apply flex flex-col items-start;
		gap: var(--spacing-xs);
	}

	.count {
		@apply font-medium text-ink;
	}

	.actions {
		padding-right: var(--spacing-md);
	}

	@media (pointer: coarse) {
		/* The author's profile link is a standalone link: a 44px touch target. */
		.author .name :global(a) {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
		}

		.actions .chip {
			height: 2.75rem;
		}

		.pick {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}

		.pick input {
			width: 1.375rem;
			height: 1.375rem;
		}
	}

	.detail > td {
		padding: 0;
	}

	.scan-note {
		padding: var(--spacing-sm) var(--spacing-md) 0;
		overflow-wrap: anywhere;
	}

	.item {
		@apply list-none m-0 p-0;
	}

	/* Below the width the columns fit, each row is a list of label and value pairs. */
	@media (max-width: 975px) {
		table,
		tbody,
		tr,
		td {
			display: block;
		}

		thead {
			@apply sr-only;
		}

		.row {
			display: grid;
			gap: var(--spacing-sm);
			padding: var(--spacing-md);
			border-top: 1px solid var(--border);
		}

		tbody > .row:first-child {
			border-top: 0;
		}

		.row > td {
			padding: 0;
			border: 0;
			background-color: transparent;
		}

		.row[data-open] {
			background-color: var(--surface-sunken);
		}

		.row > td[data-label] {
			display: grid;
			grid-template-columns: 7rem 1fr;
			gap: var(--spacing-sm);
			align-items: start;
			justify-items: start;
		}

		.row > td[data-label]::before {
			@apply text-ink-muted;
			/* The empty alternative keeps the label visual: the column header already names the cell. */
			content: attr(data-label) / '';
		}

		.comment,
		.author,
		.title,
		.scan {
			min-width: 0;
		}

		.select,
		.actions {
			width: auto;
			padding: 0;
		}

		.select {
			justify-self: start;
		}

		.detail {
			border-top: 1px solid var(--border);
		}
	}
</style>
