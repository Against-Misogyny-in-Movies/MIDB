<script lang="ts">
	import MovieSearch from '$lib/components/search/movieSearch.svelte';

	const sources = [
		{
			id: 'bechdel',
			name: 'Bechdel Test',
			body: 'Whether two named women talk to each other about something other than a man. Scored 0–3, films only.',
			source: 'bechdeltest.com',
			href: 'https://bechdeltest.com'
		},
		{
			id: 'unconsenting',
			name: 'Unconsenting Media',
			body: 'Nine flags for depictions of sexual violence, from a community database.',
			source: 'unconsentingmedia.org',
			href: 'https://www.unconsentingmedia.org'
		},
		{
			id: 'ddd',
			name: 'Does the Dog Die',
			body: 'Community-voted trigger warnings on hundreds of topics, fetched when a title page opens.',
			source: 'doesthedogdie.com',
			href: 'https://www.doesthedogdie.com'
		},
		{
			id: 'verdict',
			name: 'TMDB',
			body: 'Title details and credits, including the gender recorded for each cast and crew member.',
			source: 'themoviedb.org',
			href: 'https://www.themoviedb.org'
		}
	];
</script>

<svelte:head>
	<title>MIDB</title>
	<meta
		name="description"
		content="Sexual violence warnings and representation of women in films and series, from the Bechdel Test, Unconsenting Media, Does the Dog Die and TMDB."
	/>
</svelte:head>

<section class="hero">
	<h1 class="display" data-testid="hero-headline">
		Sexual violence warnings and representation of women in films and series
	</h1>
	<div class="search">
		<MovieSearch />
	</div>
</section>

<section class="band" aria-labelledby="sources-heading">
	<h2 id="sources-heading" class="display band-heading">Sources</h2>
	<div class="band-body">
		<dl class="sources">
			{#each sources as item (item.name)}
				<div class="source">
					<dt class="display source-name">{item.name}</dt>
					<dd>
						<p>{item.body}</p>
						<p class="source-links">
							<a class="link" href="/resources#{item.id}">How it is used</a>
							<a class="link" href={item.href} target="_blank" rel="noopener noreferrer"
								>{item.source}</a
							>
						</p>
					</dd>
				</div>
			{/each}
		</dl>
		<p class="note">
			Each title page combines them into two verdicts: content safety and representation.
		</p>
	</div>
</section>

<section class="band" aria-labelledby="about-heading">
	<h2 id="about-heading" class="display band-heading">About</h2>
	<div class="band-body">
		<p class="note about">
			MIDB has no trackers, analytics or ads, and takes no investment. The source code is on
			<a
				class="link"
				href="https://github.com/Against-Misogyny-in-Movies/MIDB"
				target="_blank"
				rel="noopener noreferrer">GitHub</a
			>.
		</p>
	</div>
</section>

<style lang="postcss">
	@reference "../app.css";

	.hero {
		padding-block: clamp(3rem, 10vw, 6.5rem) clamp(3rem, 8vw, 5rem);
	}

	h1 {
		font-size: clamp(2.25rem, 6vw, 4rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.01em;
		max-width: 22ch;
	}

	.search {
		max-width: 36rem;
		margin-top: var(--spacing-lg);
	}

	/* Heading in a narrow left column, content on the right; one column on phones. */
	.band {
		@apply grid gap-md border-t border-border;
		padding-block: var(--spacing-xl);
	}

	@media (min-width: 768px) {
		.band {
			grid-template-columns: 14rem minmax(0, 1fr);
			gap: var(--spacing-lg);
		}
	}

	.band-heading {
		@apply text-2xl;
	}

	.band-body {
		max-width: 42rem;
	}

	.sources {
		@apply flex flex-col;
	}

	.source {
		@apply flex flex-col gap-xs border-b border-border;
		padding-block: var(--spacing-md);
	}

	.source:first-child {
		padding-top: 0;
	}

	.source-name {
		@apply text-xl;
	}

	.source dd {
		@apply text-ink-muted;
	}

	.source-links {
		@apply flex flex-wrap gap-x-md text-sm;
		margin-top: var(--spacing-xs);
	}

	.note {
		@apply text-ink-muted;
		margin-top: var(--spacing-md);
	}

	.about {
		margin-top: 0;
	}
</style>
