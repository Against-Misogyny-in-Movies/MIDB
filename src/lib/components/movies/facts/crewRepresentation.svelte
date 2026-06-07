<script lang="ts">
	import type { CrewDepartment } from '$lib/media/types/media';

	interface Props {
		crewDepartments: CrewDepartment[];
	}

	let { crewDepartments }: Props = $props();

	let openDepts = $state<Set<string>>(new Set());

	function toggle(dept: string) {
		const next = new Set(openDepts);
		if (next.has(dept)) next.delete(dept);
		else next.add(dept);
		openDepts = next;
	}

	function pct(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}
</script>

{#if crewDepartments.length === 0}
	<p class="empty">No crew data available.</p>
{:else}
	<ul class="crew-table">
		<li class="crew-header" aria-hidden="true">
			<span class="header-dept">Department</span>
			<span class="header-bar">Gender split</span>
			<span class="header-counts">
				<span class="head-count"><span class="swatch seg-female"></span>W</span>
				<span class="head-count"><span class="swatch seg-male"></span>M</span>
				<span class="head-count"><span class="swatch seg-nonbinary"></span>NB</span>
				<span class="head-count"><span class="swatch seg-unknown"></span>?</span>
			</span>
		</li>

		{#each crewDepartments as dept (dept.department)}
			{@const bd = dept.breakdown}
			{@const isOpen = openDepts.has(dept.department)}
			{@const femalePct = pct(bd.female, bd.total)}
			{@const malePct = pct(bd.male, bd.total)}
			{@const nbPct = pct(bd.nonBinary, bd.total)}
			{@const unknownPct = pct(bd.unknown, bd.total)}
			{@const expandId = `crew-jobs-${dept.department.replace(/\s+/g, '-').toLowerCase()}`}

			<li class="dept-row-wrap">
				<button
					class="dept-row"
					type="button"
					aria-expanded={isOpen}
					aria-controls={expandId}
					onclick={() => toggle(dept.department)}
				>
					<span class="dept-name">
						<i
							class="ri-arrow-right-s-line dept-chevron"
							class:dept-chevron--open={isOpen}
							aria-hidden="true"
						></i>
						{dept.department}
					</span>
					<span class="bar-cell">
						<span
							class="mini-bar"
							role="img"
							aria-label="{dept.department}: {femalePct}% women, {malePct}% men"
						>
							{#if femalePct > 0}<span class="seg seg-female" style="width: {femalePct}%"></span>{/if}
							{#if malePct > 0}<span class="seg seg-male" style="width: {malePct}%"></span>{/if}
							{#if nbPct > 0}<span class="seg seg-nonbinary" style="width: {nbPct}%"></span>{/if}
							{#if unknownPct > 0}<span class="seg seg-unknown" style="width: {unknownPct}%"></span>{/if}
						</span>
					</span>
					<span class="counts-cell tabular-nums">
						<span class="c-female">{bd.female}</span>
						<span class="c-sep">/</span>
						<span class="c-male">{bd.male}</span>
						<span class="c-sep">/</span>
						<span class="c-nb">{bd.nonBinary}</span>
						<span class="c-sep">/</span>
						<span class="c-unknown">{bd.unknown}</span>
					</span>
				</button>

				{#if isOpen}
					<ul id={expandId} class="jobs-list">
						{#each dept.jobs as job (job.job)}
							{@const jbd = job.breakdown}
							{@const jFemalePct = pct(jbd.female, jbd.total)}
							{@const jMalePct = pct(jbd.male, jbd.total)}
							{@const jNbPct = pct(jbd.nonBinary, jbd.total)}
							{@const jUnknownPct = pct(jbd.unknown, jbd.total)}
							<li class="job-row">
								<span class="job-name">{job.job}</span>
								<span class="bar-cell">
									<span
										class="mini-bar"
										role="img"
										aria-label="{job.job}: {jFemalePct}% women, {jMalePct}% men"
									>
										{#if jFemalePct > 0}<span class="seg seg-female" style="width: {jFemalePct}%"></span>{/if}
										{#if jMalePct > 0}<span class="seg seg-male" style="width: {jMalePct}%"></span>{/if}
										{#if jNbPct > 0}<span class="seg seg-nonbinary" style="width: {jNbPct}%"></span>{/if}
										{#if jUnknownPct > 0}<span class="seg seg-unknown" style="width: {jUnknownPct}%"></span>{/if}
									</span>
								</span>
								<span class="counts-cell tabular-nums">
									<span class="c-female">{jbd.female}</span>
									<span class="c-sep">/</span>
									<span class="c-male">{jbd.male}</span>
									<span class="c-sep">/</span>
									<span class="c-nb">{jbd.nonBinary}</span>
									<span class="c-sep">/</span>
									<span class="c-unknown">{jbd.unknown}</span>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.empty {
		@apply text-ink-muted text-sm;
	}

	.crew-table {
		@apply list-none m-0 p-0 overflow-hidden rounded-lg border border-border;
		background-color: var(--surface-raised);
	}

	/* Shared column geometry */
	.crew-header,
	.dept-row,
	.job-row {
		@apply grid items-center gap-md px-md py-sm;
		grid-template-columns: minmax(0, 1fr) minmax(5rem, 10rem) 6rem;
	}

	.crew-header {
		background-color: color-mix(in oklab, var(--brand) 4%, var(--surface-raised));
		border-bottom: 1px solid var(--border);
	}

	.header-dept,
	.header-bar,
	.header-counts {
		@apply text-xs font-semibold text-ink-muted;
		font-variant-caps: all-small-caps;
		letter-spacing: 0.04em;
	}

	.header-counts {
		@apply flex items-center justify-end gap-2;
	}

	.head-count {
		@apply inline-flex items-center gap-1;
	}

	.head-count .swatch {
		@apply inline-block rounded-xs shrink-0;
		width: 0.5rem;
		height: 0.5rem;
	}

	/* Department row */
	.dept-row-wrap {
		border-bottom: 1px solid var(--border);
	}

	.dept-row-wrap:last-child {
		@apply border-b-0;
	}

	.dept-row {
		@apply w-full text-left bg-transparent border-0 cursor-pointer;
		transition: background-color 0.12s ease;
		font: inherit;
		color: inherit;
	}

	.dept-row:hover {
		background-color: color-mix(in oklab, var(--brand) 6%, transparent);
	}

	.dept-row:focus-visible {
		@apply outline-none;
		box-shadow: inset 0 0 0 2px var(--brand);
	}

	.dept-name {
		@apply flex items-center gap-xs text-sm font-semibold text-ink min-w-0 truncate;
	}

	.dept-chevron {
		@apply text-base text-ink-muted shrink-0;
		transition: transform 0.18s ease;
	}

	.dept-chevron--open {
		transform: rotate(90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.dept-chevron {
			transition: none;
		}
	}

	/* Job sublist */
	.jobs-list {
		@apply list-none m-0 p-0;
		border-top: 1px solid var(--border);
		background-color: color-mix(in oklab, var(--ink) 4%, transparent);
	}

	.job-row {
		@apply border-b border-border;
		padding-left: calc(var(--spacing-md) + 1.25rem);
	}

	.job-row:last-child {
		@apply border-b-0;
	}

	.job-name {
		@apply text-sm text-ink truncate;
	}

	/* Bar cell */
	.bar-cell {
		@apply flex items-center;
	}

	.mini-bar {
		@apply relative flex overflow-hidden rounded-sm w-full;
		height: 0.625rem;
		background-color: var(--border);
	}

	.seg { @apply h-full; }
	.seg-female { background-color: var(--brand); }
	.seg-male { background-color: var(--seg-male); }
	.seg-nonbinary { background-color: var(--accent-bg); }
	.seg-unknown { background-color: var(--border); }

	/* Counts */
	.counts-cell {
		@apply flex items-center justify-end gap-1 text-sm;
	}

	.c-sep { @apply text-ink-muted opacity-40; }
	/* Numbers stay high-contrast for legibility; colour identity lives in the
	   bar + header swatches, not in the digits themselves. */
	.c-female,
	.c-male,
	.c-nb { @apply font-semibold text-ink tabular-nums; }
	.c-unknown { @apply text-ink-muted tabular-nums; }

	/* Mobile */
	@media (max-width: 767px) {
		.crew-header {
			@apply hidden;
		}

		.dept-row,
		.job-row {
			@apply flex flex-wrap gap-x-md gap-y-xs py-md;
		}

		.dept-name {
			@apply w-full;
		}

		.job-name {
			@apply w-full whitespace-normal;
			overflow: visible;
			text-overflow: clip;
		}

		.bar-cell {
			@apply flex-1;
		}

		.job-row {
			padding-left: calc(var(--spacing-md) + 1.25rem);
		}
	}
</style>
