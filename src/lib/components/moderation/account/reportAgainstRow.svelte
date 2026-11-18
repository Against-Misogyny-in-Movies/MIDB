<script lang="ts">
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { ReportAgainst } from '#lib/media/types/moderation.ts';
	import { COMMENT_STATUS_LABELS, REPORT_REASON_LABELS } from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { recordLine } from '#lib/media/utils/reporterRecord.ts';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		report: ReportAgainst;
	}

	let { report }: Props = $props();

	const { comment } = $derived(report);
	const permalink = $derived(commentHref(comment.title.kind, comment.title.tmdbId, comment.id));
</script>

<li class="row">
	<div class="meta">
		<Badge tone="neutral">{REPORT_REASON_LABELS[report.reason]}</Badge>
		<span class="label"
			>Reported by <AccountLink
				id={report.reporterId}
				username={report.reporter}
				name={report.reporter ?? 'An account'}
			/></span
		>
		<span class="label">{recordLine(report.record)}</span>
		<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
	</div>
	{#if report.note}<p class="note">{report.note}</p>{/if}
	<div class="meta">
		<ProfileTitleLink
			kind={comment.title.kind}
			tmdbId={comment.title.tmdbId}
			name={comment.title.name}
		/>
		{#if permalink}<CommentLink href={permalink} />{/if}
		<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge>
	</div>
	<p class="body">{comment.body}</p>
</li>

<style lang="postcss">
	@reference "../../../../app.css";

	.row {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.note {
		@apply text-sm;
		overflow-wrap: anywhere;
	}

	.body {
		@apply line-clamp-3 text-sm text-ink-muted;
		overflow-wrap: anywhere;
	}
</style>
