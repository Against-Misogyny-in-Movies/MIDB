<script lang="ts">
	import { resolve } from '$app/paths';
	import { displayTitle } from '$lib/media/utils/format';
	import { filmSentence } from '$lib/media/utils/filmSentence';
	import type { RatedFilm } from '$lib/media/types/catalogue';

	interface Props {
		films: RatedFilm[];
		/** A film without a TMDB id can't link to its page; its title runs through search. */
		onsearch: (title: string) => void;
		/** Seconds each sentence stays before the next. */
		seconds?: number;
	}

	let { films, onsearch, seconds = 6 }: Props = $props();

	let index = $state(0);
	// Rotation stops while the pointer or focus is inside, and when the visitor presses pause.
	let hovering = $state(false);
	let focused = $state(false);
	let stopped = $state(false);
	// After a visitor picks a film, announce the sentence; during auto-rotation, stay quiet.
	let chosen = $state(false);
	const paused = $derived(hovering || focused || stopped);

	const items = $derived(
		films.map((film) => ({ film, title: displayTitle(film.title), sentence: filmSentence(film) }))
	);

	// The active chip's fill animation is the timer: when it ends, the next film shows. Under
	// prefers-reduced-motion the fill has no animation, so nothing rotates on its own.
	function next() {
		index = (index + 1) % items.length;
	}

	function pick(i: number) {
		index = i;
		chosen = true;
	}
</script>

<div
	class="film-sentences"
	style="--seconds: {seconds}s"
	role="group"
	aria-roledescription="carousel"
	aria-label="Example films from the database"
	onmouseenter={() => (hovering = true)}
	onmouseleave={() => (hovering = false)}
	onfocusin={() => (focused = true)}
	onfocusout={() => (focused = false)}
>
	<!-- Every sentence sits in the same grid cell, so the cell is as tall as the longest one and
	     switching never moves the search bar below. -->
	<div class="stack" aria-live={chosen ? 'polite' : 'off'} data-testid="hero-headline">
		{#each items as { film, title, sentence }, i (film.title + film.year)}
			<p class="sentence" class:active={i === index} inert={i !== index}>
				{#if film.tmdbId}
					<a class="film" href={resolve('/movie/[movieId]', { movieId: String(film.tmdbId) })}
						>{title}</a
					>
				{:else}
					<button type="button" class="film" onclick={() => onsearch(title)}>{title}</button>
				{/if}
				<mark class="tone-{sentence.bechdel.tone}">{sentence.bechdel.text}</mark>
				{sentence.joiner}
				<mark class="tone-{sentence.um.tone}">{sentence.um.text}</mark>.
			</p>
		{/each}
	</div>

	<div class="pager">
		<ul aria-label="Films">
			{#each items as { film, title }, i (film.title + film.year)}
				<li>
					<button
						type="button"
						class="chip"
						class:active={i === index}
						aria-pressed={i === index}
						onclick={() => pick(i)}
					>
						{#if i === index}
							<span class="fill" class:paused onanimationend={next} aria-hidden="true"></span>
						{/if}
						<span class="chip-label">{title}</span>
					</button>
				</li>
			{/each}
			<li>
				<button
					type="button"
					class="toggle"
					aria-label={stopped ? 'Play' : 'Pause'}
					title={stopped ? 'Play' : 'Pause'}
					onclick={() => (stopped = !stopped)}
				>
					<i class={stopped ? 'ri-play-fill' : 'ri-pause-fill'} aria-hidden="true"></i>
				</button>
			</li>
		</ul>
	</div>

	<p class="caption">Examples from the database, by IMDb votes.</p>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.film-sentences {
		@apply flex flex-col items-center w-full;
	}

	/* ── Sentences ── */
	.stack {
		@apply grid w-full;
		max-width: 52rem;
	}

	.sentence {
		grid-area: 1 / 1;
		align-self: center;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: clamp(1.75rem, 5.2vw, 3.25rem);
		line-height: 1.22;
		letter-spacing: -0.015em;
		text-wrap: balance;
		opacity: 0;
		visibility: hidden;
		transform: translateY(0.25em);
		filter: blur(6px);
		transition:
			opacity 0.5s var(--ease-out),
			transform 0.6s var(--ease-out),
			filter 0.5s var(--ease-out),
			visibility 0s linear 0.5s;
	}

	.sentence.active {
		opacity: 1;
		visibility: visible;
		transform: none;
		filter: none;
		transition-delay: 0s;
	}

	.film {
		@apply bg-transparent border-0 p-0 cursor-pointer;
		font: inherit;
		font-weight: 700;
		letter-spacing: inherit;
		color: var(--brand);
		text-decoration: underline;
		text-decoration-thickness: 0.06em;
		text-underline-offset: 0.14em;
		text-decoration-color: color-mix(in oklab, var(--brand) 30%, transparent);
		transition: text-decoration-color 0.15s ease;
	}

	.film:hover {
		text-decoration-color: var(--brand);
	}

	/* A highlighter stroke under the lower part of each clause, in its badge tone. */
	mark {
		padding-inline: 0.06em;
		background: none;
		color: var(--tone);
		box-shadow: inset 0 -0.34em 0 var(--tone-soft);
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	.tone-pos {
		--tone: var(--success);
		--tone-soft: var(--success-soft);
	}

	.tone-mid {
		--tone: var(--warn);
		--tone-soft: var(--warn-soft);
	}

	.tone-neg {
		--tone: var(--danger);
		--tone-soft: var(--danger-soft);
	}

	.tone-neutral {
		--tone: var(--ink-muted);
		--tone-soft: var(--secondary-soft);
	}

	/* ── Pager: the film titles, the active one filling as its timer ── */
	.pager {
		margin-top: 1.75rem;
		max-width: 46rem;
	}

	.pager ul {
		@apply flex flex-wrap items-center justify-center list-none m-0 p-0;
		gap: 6px;
	}

	.chip {
		@apply relative inline-flex items-center overflow-hidden cursor-pointer;
		height: 1.875rem;
		padding-inline: 12px;
		border: 1px solid var(--border);
		border-radius: 9999px;
		background-color: var(--surface-raised);
		color: var(--ink-muted);
		font-size: 0.8125rem;
		font-weight: 500;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.chip:hover {
		border-color: var(--border-strong);
		color: var(--ink);
	}

	.chip.active {
		border-color: color-mix(in oklab, var(--brand) 35%, var(--border));
		background-color: var(--brand-wash);
		color: var(--brand);
	}

	.chip-label {
		@apply relative truncate;
		max-width: 12rem;
	}

	.fill {
		@apply absolute inset-y-0 left-0;
		width: 100%;
		transform-origin: left;
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		animation: fill var(--seconds) linear forwards;
	}

	.fill.paused {
		animation-play-state: paused;
	}

	@keyframes fill {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	.toggle {
		@apply inline-flex items-center justify-center shrink-0 cursor-pointer;
		width: 1.875rem;
		height: 1.875rem;
		border: 1px solid var(--border);
		border-radius: 9999px;
		background-color: var(--surface-raised);
		color: var(--ink-muted);
		transition: color 0.15s ease;
	}

	.toggle:hover {
		color: var(--ink);
	}

	.caption {
		@apply text-xs text-ink-muted;
		margin-top: 10px;
	}

	@media (prefers-reduced-motion: reduce) {
		.sentence {
			transform: none;
			filter: none;
			transition: none;
		}

		/* No timer, so no auto-rotation; the chips still switch films. */
		.fill {
			animation: none;
			transform: scaleX(1);
		}

		.toggle {
			display: none;
		}
	}
</style>
