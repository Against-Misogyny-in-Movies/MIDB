<script lang="ts">
	import type { PageData } from './$types';
	import MovieSearch from '$lib/components/search/movieSearch.svelte';
	import { MovieSearchState } from '$lib/components/search/movieSearch.svelte.js';
	import RatedFilms from '$lib/components/landing/ratedFilms.svelte';

	let { data }: { data: PageData } = $props();

	const search = new MovieSearchState();
	let hero = $state<HTMLElement | null>(null);

	// A data-card row without a TMDB id runs its title through the search field instead.
	function searchFor(title: string) {
		search.search(title);
		hero?.querySelector('input')?.focus();
	}

	const fmt = (n: number) => n.toLocaleString('en-US');

	const sources = [
		{
			id: 'bechdel',
			name: 'Bechdel Test',
			body: 'Whether two named women talk to each other about something other than a man. Scored 0–3, films only.',
			icon: 'ri-chat-3-fill',
			color: 'var(--l-emerald)',
			domain: 'bechdeltest.com',
			href: 'https://bechdeltest.com'
		},
		{
			id: 'unconsenting',
			name: 'Unconsenting Media',
			body: 'Nine flags for depictions of sexual violence, from a community database.',
			icon: 'ri-flag-2-fill',
			color: 'var(--l-violet)',
			domain: 'unconsentingmedia.org',
			href: 'https://www.unconsentingmedia.org'
		},
		{
			id: 'ddd',
			name: 'Does the Dog Die',
			body: 'Community-voted trigger warnings on hundreds of topics, fetched when a title page opens.',
			icon: 'ri-alarm-warning-fill',
			color: 'var(--l-cobalt)',
			domain: 'doesthedogdie.com',
			href: 'https://www.doesthedogdie.com'
		},
		{
			id: 'verdict',
			name: 'TMDB',
			body: 'Title details and credits, including the gender recorded for each cast and crew member.',
			icon: 'ri-film-fill',
			color: 'var(--l-pink)',
			domain: 'themoviedb.org',
			href: 'https://www.themoviedb.org'
		}
	];

	// The six tiers from verdict.ts, toned like the data card's badges.
	const verdicts = [
		{
			axis: 'Content safety',
			tiers: [
				{ label: 'Safer to watch', tone: 'pos' },
				{ label: 'Watch with caution', tone: 'mid' },
				{ label: 'Harmful content', tone: 'neg' }
			]
		},
		{
			axis: 'Representation',
			tiers: [
				{ label: 'Strong representation', tone: 'pos' },
				{ label: 'Mixed representation', tone: 'mid' },
				{ label: 'Poor representation', tone: 'neg' }
			]
		}
	];
</script>

<svelte:head>
	<title>MIDB</title>
	<meta
		name="description"
		content="Sexual violence warnings and representation of women in films and series, from the Bechdel Test, Unconsenting Media, Does the Dog Die and TMDB."
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="landing">
	<section class="hero" bind:this={hero}>
		<h1 data-testid="hero-headline">
			Sexual violence warnings and representation of women in films and series
		</h1>

		<div class="search">
			<MovieSearch {search} />
		</div>

		{#if data.counts}
			<ul class="stats">
				<li>
					<i class="ri-chat-3-fill" aria-hidden="true"></i>
					<strong>{fmt(data.counts.bechdelRatings)}</strong> Bechdel Test ratings
				</li>
				<li>
					<i class="ri-flag-2-fill" aria-hidden="true"></i>
					<strong>{fmt(data.counts.umEntries)}</strong> Unconsenting Media entries
				</li>
				<li>
					<i class="ri-alarm-warning-fill" aria-hidden="true"></i>
					<strong>Live</strong> Does the Dog Die warnings
				</li>
			</ul>
		{/if}
	</section>

	{#if data.films.length > 0}
		<div class="preview">
			<RatedFilms films={data.films} onsearch={searchFor} />
		</div>
	{/if}

	<section class="section" aria-labelledby="sources-heading">
		<h2 id="sources-heading" class="section-title">Sources</h2>
		<ul class="sources">
			{#each sources as source (source.name)}
				<li class="source">
					<span class="disk" style="--disk: {source.color}" aria-hidden="true">
						<i class={source.icon}></i>
					</span>
					<h3>{source.name}</h3>
					<p>{source.body}</p>
					<p class="source-links">
						<a class="action-link" href="/resources#{source.id}">Methodology</a>
						<a class="quiet-link" href={source.href} target="_blank" rel="noopener noreferrer"
							>{source.domain}</a
						>
					</p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="section" aria-labelledby="verdicts-heading">
		<div class="verdicts">
			<div class="verdicts-text">
				<h2 id="verdicts-heading">Two verdicts per title</h2>
				<p>
					Each title page combines the sources into a content safety and a representation verdict.
				</p>
				<a class="ghost-button" href="/resources#verdict">Methodology</a>
			</div>
			<dl class="tiers">
				{#each verdicts as group (group.axis)}
					<div class="tier-group">
						<dt>{group.axis}</dt>
						<dd>
							{#each group.tiers as tier (tier.label)}
								<span class="tier tier--{tier.tone}">{tier.label}</span>
							{/each}
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>

	<p class="about">
		No trackers, analytics or ads. No investment. The source code is on
		<a
			class="quiet-link"
			href="https://github.com/Against-Misogyny-in-Movies/MIDB"
			target="_blank"
			rel="noopener noreferrer">GitHub</a
		>.
	</p>
</div>

<style lang="postcss">
	@reference "../app.css";

	.landing {
		font-family: var(--l-font-ui);
		color: var(--l-ink);
		letter-spacing: -0.025em;
	}

	/* ── Hero: centred stack ── */
	.hero {
		@apply flex flex-col items-center text-center;
		padding-block: clamp(3rem, 9vw, 5rem) 3rem;
	}

	h1 {
		font-family: var(--l-font-display);
		font-weight: 700;
		font-size: clamp(2.25rem, 7vw, 3.75rem);
		line-height: 1;
		letter-spacing: -0.011em;
		max-width: 45rem;
		text-wrap: balance;
	}

	.search {
		@apply w-full text-left;
		max-width: 40rem;
		margin-top: 2.5rem;
	}

	.stats {
		@apply flex flex-wrap justify-center list-none m-0 p-0;
		gap: 12px 32px;
		margin-top: 1.5rem;
		font-size: 0.875rem;
		color: var(--l-graphite);
	}

	.stats li {
		@apply flex items-center;
		gap: 6px;
	}

	.stats i {
		font-size: 1rem;
		color: var(--l-emerald);
	}

	.stats strong {
		font-weight: 600;
		color: var(--l-ink);
		font-variant-numeric: tabular-nums;
	}

	/* ── Floating data card ── */
	.preview {
		@apply mx-auto;
		max-width: 52rem;
	}

	/* ── Sections ── */
	.section {
		margin-top: 4rem;
	}

	.section-title {
		@apply text-center;
		font-family: var(--l-font-display);
		font-weight: 700;
		font-size: clamp(1.875rem, 4vw, 2.25rem);
		line-height: 1.11;
		letter-spacing: -0.013em;
		margin-bottom: 2rem;
	}

	.sources {
		@apply grid list-none m-0 p-0;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	@media (min-width: 560px) {
		.sources {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 976px) {
		.sources {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.source {
		@apply flex flex-col items-center text-center;
		padding: 32px 24px;
		border: 1px solid var(--l-border);
		border-radius: 12px;
		background-color: var(--l-canvas);
	}

	.disk {
		@apply flex items-center justify-center rounded-full;
		width: 2.5rem;
		height: 2.5rem;
		font-size: 1.25rem;
		color: #ffffff;
		background-color: var(--disk);
	}

	.source h3 {
		font-size: 1.125rem;
		font-weight: 600;
		line-height: 1.33;
		margin-top: 16px;
	}

	.source p {
		font-size: 0.875rem;
		line-height: 1.43;
		color: var(--l-graphite);
		margin-top: 6px;
	}

	.source .source-links {
		@apply flex flex-wrap justify-center;
		gap: 4px 16px;
		margin-top: auto;
		padding-top: 16px;
	}

	.action-link {
		font-weight: 600;
		color: var(--l-emerald-text);
		text-decoration: none;
	}

	.action-link:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.quiet-link {
		color: var(--l-slate);
		text-decoration: underline;
		text-decoration-color: var(--l-border-strong);
		text-underline-offset: 3px;
		transition: color 0.15s ease;
	}

	.quiet-link:hover {
		color: var(--l-ink);
	}

	/* ── Verdicts: a fog plate with the real tier names ── */
	.verdicts {
		@apply grid items-center;
		gap: 24px 48px;
		padding: 32px;
		border-radius: 12px;
		background-color: var(--l-fog);
	}

	@media (min-width: 768px) {
		.verdicts {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		}
	}

	.verdicts h2 {
		font-family: var(--l-font-display);
		font-weight: 600;
		font-size: 1.5rem;
		line-height: 1.33;
		letter-spacing: -0.02em;
	}

	.verdicts-text p {
		color: var(--l-graphite);
		margin-top: 8px;
	}

	.ghost-button {
		@apply inline-flex items-center no-underline;
		margin-top: 20px;
		padding: 10px 20px;
		border: 1px solid var(--l-border);
		border-radius: 8px;
		background-color: var(--l-canvas);
		color: var(--l-ink);
		font-size: 0.875rem;
		font-weight: 600;
		transition: border-color 0.15s ease;
	}

	.ghost-button:hover {
		border-color: var(--l-border-strong);
	}

	.tiers {
		@apply flex flex-col;
		gap: 16px;
	}

	.tier-group dt {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--l-slate);
		margin-bottom: 6px;
	}

	.tier-group dd {
		@apply flex flex-wrap;
		gap: 6px;
	}

	.tier {
		padding: 4px 12px;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.tier--pos {
		background-color: var(--l-pos-bg);
		color: var(--l-pos-fg);
	}

	.tier--mid {
		background-color: var(--l-mid-bg);
		color: var(--l-mid-fg);
	}

	.tier--neg {
		background-color: var(--l-neg-bg);
		color: var(--l-neg-fg);
	}

	/* ── About ── */
	.about {
		@apply text-center;
		margin-top: 4rem;
		font-size: 0.875rem;
		color: var(--l-graphite);
	}

	@media (prefers-reduced-motion: reduce) {
		.quiet-link,
		.ghost-button {
			transition: none;
		}
	}
</style>
