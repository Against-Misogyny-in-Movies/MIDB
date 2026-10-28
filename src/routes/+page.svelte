<script lang="ts">
	import type { PageData } from './$types';
	import MovieSearch from '$lib/components/search/movieSearch.svelte';
	import FilmSentences from '$lib/components/landing/filmSentences.svelte';

	let { data }: { data: PageData } = $props();

	const fmt = (n: number) => n.toLocaleString('en-US');
	const bechdelCount = $derived(data.counts ? `${fmt(data.counts.bechdelRatings)} films` : 'films');
	const umCount = $derived(
		data.counts ? `${fmt(data.counts.umEntries)} films and series` : 'films and series'
	);

	// One card per source: its name highlighted in its violet shade, then the rest of the sentence.
	const sources = $derived([
		{
			id: 'bechdel',
			name: 'Bechdel Test',
			rest: `rates ${bechdelCount} on whether two named women talk to each other about something other than a man.`,
			icon: 'ri-chat-3-fill',
			domain: 'bechdeltest.com',
			href: 'https://bechdeltest.com'
		},
		{
			id: 'um',
			anchor: 'unconsenting',
			name: 'Unconsenting Media',
			rest: `records nine sexual violence flags for ${umCount}.`,
			icon: 'ri-flag-2-fill',
			domain: 'unconsentingmedia.org',
			href: 'https://www.unconsentingmedia.org'
		},
		{
			id: 'ddd',
			name: 'Does the Dog Die',
			rest: 'collects yes or no votes on hundreds of trigger warnings, fetched when a title page opens.',
			icon: 'ri-alarm-warning-fill',
			domain: 'doesthedogdie.com',
			href: 'https://www.doesthedogdie.com'
		},
		{
			id: 'tmdb',
			anchor: 'verdict',
			name: 'TMDB',
			rest: 'supplies title details and credits, including the gender recorded for each cast and crew member.',
			icon: 'ri-film-fill',
			domain: 'themoviedb.org',
			href: 'https://www.themoviedb.org'
		}
	]);
</script>

<svelte:head>
	<title>MIDB</title>
	<meta
		name="description"
		content="Sexual violence warnings and representation of women in films and series, from the Bechdel Test, Unconsenting Media, Does the Dog Die and TMDB."
	/>
</svelte:head>

<div class="landing">
	<section class="hero">
		<!-- The hero shows what MIDB does with real records; the heading names it for assistive
		     tech and search engines, and is the visible fallback when the database is unreachable. -->
		<h1
			class:sr-only={data.films.length > 0}
			data-testid={data.films.length > 0 ? undefined : 'hero-headline'}
		>
			Sexual violence warnings and representation of women in films and series
		</h1>
		{#if data.films.length > 0}
			<FilmSentences films={data.films} />
		{/if}

		<div class="search">
			<MovieSearch />
		</div>
	</section>

	<!-- What MIDB is, in one sentence under the search: each record is highlighted in its source's
	     shade, after that source's disk. -->
	<section class="intro" aria-label="About MIDB">
		<span class="intro-disks" aria-hidden="true">
			{#each sources as source (source.id)}
				<span class="disk" style="--hue: var(--src-{source.id}); --disk: 2rem">
					<i class={source.icon}></i>
				</span>
			{/each}
		</span>
		<p class="statement">
			MIDB puts <mark class="highlight tone-um">sexual violence flags</mark>,
			<mark class="highlight tone-ddd">trigger warnings</mark>, the
			<mark class="highlight tone-bechdel">Bechdel Test</mark> and
			<mark class="highlight tone-tmdb">cast and crew gender</mark> on one page per film or series.
		</p>
		<a class="chip" href="/resources">Methodology</a>
	</section>

	<!-- The sections keep their cards and speak in the hero's voice: Inter Tight sentences,
	     highlighted names, chips for links. -->
	<section class="section" aria-labelledby="sources-heading">
		<h2 id="sources-heading" class="section-title">Sources</h2>
		<ul class="sources">
			{#each sources as source (source.id)}
				<li class="card source">
					<span class="disk" style="--hue: var(--src-{source.id})" aria-hidden="true">
						<i class={source.icon}></i>
					</span>
					<p class="statement">
						<mark class="highlight tone-{source.id}">{source.name}</mark>
						{source.rest}
					</p>
					<p class="chips">
						<a class="chip" href="/resources#{source.anchor ?? source.id}">Methodology</a>
						<a class="chip" href={source.href} target="_blank" rel="noopener noreferrer"
							>{source.domain} <i class="ri-arrow-right-up-line" aria-hidden="true"></i></a
						>
					</p>
				</li>
			{/each}
		</ul>
	</section>

	<!-- The tier names and tones mirror SAFETY_META / REP_META in verdict.ts and tones.ts. -->
	<section class="section" aria-labelledby="verdicts-heading">
		<h2 id="verdicts-heading" class="section-title">Verdicts</h2>
		<div class="verdicts">
			<p class="statement statement--lead">
				Each title page combines the sources into two verdicts.
			</p>
			<div class="tiers">
				<p class="statement">
					Content safety: <mark class="highlight tone-pos">Safer to watch</mark>,
					<mark class="highlight tone-mid">Watch with caution</mark> or
					<mark class="highlight tone-neg">Harmful content</mark>.
				</p>
				<p class="statement">
					Representation: <mark class="highlight tone-pos">Strong</mark>,
					<mark class="highlight tone-mid">Mixed</mark> or
					<mark class="highlight tone-neg">Poor</mark>.
				</p>
				<p class="statement">
					Too little data reads <mark class="highlight tone-neutral">Not enough data</mark>.
				</p>
				<p class="chips">
					<a class="chip" href="/resources#verdict">Methodology</a>
				</p>
			</div>
		</div>
	</section>

	<section class="section about" aria-label="About">
		<p class="statement">MIDB has no trackers, analytics or ads, and takes no investment.</p>
		<p class="chips">
			<a
				class="chip"
				href="https://github.com/Against-Misogyny-in-Movies/MIDB"
				target="_blank"
				rel="noopener noreferrer"
				>Source code <i class="ri-arrow-right-up-line" aria-hidden="true"></i></a
			>
		</p>
	</section>
</div>

<style lang="postcss">
	@reference "../app.css";

	.landing {
		font-family: var(--font-body);
		color: var(--ink);
	}

	/* ── Hero: centred stack ── */
	.hero {
		@apply flex flex-col items-center text-center;
		padding-block: clamp(3rem, 8vw, 4.5rem) 1rem;
	}

	h1 {
		font-family: var(--font-display);
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

	/* ── Sections: a centred title over cards, like the hero ── */
	.section {
		margin-top: clamp(3.5rem, 8vw, 5rem);
	}

	.section-title {
		@apply text-center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.875rem, 4vw, 2.25rem);
		line-height: 1.11;
		letter-spacing: -0.013em;
		margin-bottom: 2rem;
	}

	/* The hero's voice at card size: Inter Tight sentences with highlighted names. */
	.statement {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.1875rem;
		line-height: 1.35;
		letter-spacing: -0.015em;
		text-wrap: pretty;
	}

	.chips {
		@apply flex flex-wrap;
		gap: 6px;
	}

	.chips i {
		font-size: 0.875rem;
	}

	/* Sources: four cards, two on small screens, one on phones. */
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
		@apply flex flex-col;
		gap: 16px;
		padding: 24px;
	}

	.source .chips {
		margin-top: auto;
	}

	/* Verdicts: the lilac plate, the lead sentence beside the tier sentences. */
	.verdicts {
		@apply grid;
		gap: 20px 48px;
		padding: 32px;
		border-radius: 12px;
		background-color: var(--brand-wash);
	}

	@media (min-width: 768px) {
		.verdicts {
			grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		}
	}

	.statement--lead {
		font-size: clamp(1.375rem, 2.6vw, 1.75rem);
		line-height: 1.25;
	}

	.tiers {
		@apply flex flex-col;
		gap: 10px;
	}

	.tiers .chips {
		margin-top: 10px;
	}

	/* Intro: one card under the search, the source disks beside the sentence. */
	.intro {
		@apply flex flex-col items-center text-center;
		gap: 16px;
		max-width: 52rem;
		margin: 2.5rem auto 0;
		padding: 24px 28px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background-color: var(--surface-raised);
	}

	.intro .statement {
		font-size: clamp(1.25rem, 2.4vw, 1.5rem);
	}

	.intro-disks {
		@apply flex flex-shrink-0;
	}

	/* The disks overlap like a stack, each ringed in the card colour. */
	.intro-disks .disk {
		box-shadow: 0 0 0 2px var(--surface-raised);
	}

	.intro-disks .disk + .disk {
		margin-left: -6px;
	}

	.intro .chip {
		flex-shrink: 0;
	}

	@media (min-width: 768px) {
		.intro {
			flex-direction: row;
			gap: 24px;
			text-align: left;
		}
	}

	/* About: one centred sentence and its link. */
	.about {
		@apply flex flex-col items-center text-center;
		gap: 14px;
	}

	.about .statement {
		font-size: clamp(1.25rem, 2.4vw, 1.5rem);
		max-width: 32rem;
	}

	@media (max-width: 479px) {
		.verdicts {
			padding: 24px 20px;
		}
	}
</style>
