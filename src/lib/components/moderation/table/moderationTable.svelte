<script lang="ts">
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ModerationTableRow } from '#lib/media/types/moderation.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import {
		COMMENT_STATUS_LABELS,
		REPORT_REASON_LABELS,
		categoryLabel
	} from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';
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

<!-- The focus lands here when an action takes its row off the page (`rowSubmit`'s default fallback). -->
<div class="card" id="moderation-empty" tabindex="-1">
	{#if rows.length === 0}
		<p class="empty">No comments match these filters.</p>
	{:else}
		<table>
			<caption class="sr-only">
				{rows.length}
				{rows.length === 1 ? 'comment' : 'comments'} on this page, with the automatic check, open reports
				and latest scan of each
			</caption>
			<thead>
				<tr>
					<th scope="col" class="select"><span class="sr-only">Select</span></th>
					<th scope="col" class="comment">Comment</th>
					<th scope="col">Author</th>
					<th scope="col">Title</th>
					<th scope="col">Status</th>
					<th scope="col">Automatic check</th>
					<th scope="col">Reports</th>
					<th scope="col">Scan</th>
					<th scope="col">Posted</th>
					<th scope="col"><span class="sr-only">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.comment.id)}
					{@const id = row.comment.id}
					{@const href = titleHref(row.title.kind, row.title.tmdbId)}
					{@const open = openId === id}
					<tr class="row" data-open={open || undefined}>
						<td class="select">
							<input
								type="checkbox"
								value={id}
								bind:group={selected}
								aria-label="Select the comment by {row.author.displayName} on {row.title.name}"
							/>
						</td>
						<td class="comment" data-label="Comment">
							<p class="clamp body">{row.comment.body}</p>
						</td>
						<td data-label="Author">
							<span class="name">{row.author.displayName}</span>
							{#if row.author.role !== 'user'}
								<Badge tone="brand">
									{row.author.role === 'moderator' ? 'Moderator' : 'Administrator'}
								</Badge>
							{/if}
						</td>
						<td data-label="Title">
							<span class="clamp">
								{#if href}<a class="link" {href}>{row.title.name}</a>{:else}{row.title.name}{/if}
							</span>
						</td>
						<td data-label="Status">
							<Badge tone={commentStatusTone(row.comment.status)}>
								{COMMENT_STATUS_LABELS[row.comment.status]}
							</Badge>
						</td>
						<td data-label="Automatic check">
							<div class="stack">
								{#if row.aiFailure}
									<span class="label">Check failed</span>
								{:else if row.severity === null}
									<span class="label">No verdict</span>
								{:else if row.severity === 0 && row.aiCategories.length === 0}
									<span class="label">No concerns</span>
								{:else}
									{#each row.aiCategories as category (category)}
										<Badge tone="neutral">{categoryLabel(category)}</Badge>
									{/each}
									{#if row.severity > 0}
										<Badge tone={severityTone(row.severity)}>Severity {row.severity}</Badge>
									{/if}
								{/if}
							</div>
						</td>
						<td data-label="Reports">
							{#if row.reports.length > 0}
								<div class="stack">
									<span class="num count">{row.reports.length} open</span>
									<span class="label">{reasons(row).join(', ')}</span>
								</div>
							{:else}
								<span class="label">None</span>
							{/if}
						</td>
						<td data-label="Scan">
							{#if row.latestLabel}
								<div class="stack">
									<Badge tone={row.latestLabel.matched ? 'neg' : 'neutral'}>
										{row.latestLabel.matched ? 'Matched' : 'No match'}
									</Badge>
									<span class="label clamp">{row.latestLabel.concern}</span>
								</div>
							{:else}
								<span class="label">Not scanned</span>
							{/if}
						</td>
						<td data-label="Posted">
							<time class="num" datetime={row.comment.createdAt}>
								{formatDate(row.comment.createdAt)}
							</time>
						</td>
						<td class="actions">
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
						<tr class="detail" id="detail-{id}">
							<td colspan={COLUMNS}>
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
									<ModerationItemRow item={row} canActOnAuthor={canActOn(me, row.author)} />
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
		padding-inline: var(--spacing-md) 0;
	}

	.select input {
		@apply cursor-pointer;
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand);
	}

	.comment {
		min-width: 12rem;
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
		.actions .chip {
			height: 2.75rem;
		}

		.select input {
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
	@media (max-width: 60.99rem) {
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
		}

		.row > td[data-label]::before {
			@apply text-ink-muted;
			content: attr(data-label);
		}

		.comment {
			min-width: 0;
		}

		.select,
		.actions {
			width: auto;
			padding: 0;
		}

		.detail {
			border-top: 1px solid var(--border);
		}
	}
</style>
