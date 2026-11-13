<script lang="ts">
	import { enhance } from '$app/forms';
	import type { TitleReport } from '#lib/media/types/moderation.ts';
	import type { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		userId: string;
		titleId: string;
		/** A counted report offers only Reject, a rejected one only Count it, a held one both. */
		status: TitleReport['status'];
		busy: string | null;
		submit: ReturnType<typeof rowSubmit>;
	}

	let { userId, titleId, status, busy, submit }: Props = $props();
</script>

{#if status !== 'counted'}
	<form method="POST" action="?/countReport" use:enhance={submit('countReport')}>
		<input type="hidden" name="userId" value={userId} />
		<input type="hidden" name="titleId" value={titleId} />
		<button class="btn btn--ink" aria-busy={busy === 'countReport'} disabled={busy !== null}>
			Count it
		</button>
	</form>
{/if}
{#if status !== 'rejected'}
	<form method="POST" action="?/rejectReport" use:enhance={submit('rejectReport')}>
		<input type="hidden" name="userId" value={userId} />
		<input type="hidden" name="titleId" value={titleId} />
		<button class="btn btn--ghost" aria-busy={busy === 'rejectReport'} disabled={busy !== null}>
			Reject
		</button>
	</form>
{/if}
