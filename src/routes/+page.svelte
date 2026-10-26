<script lang="ts">
	import MovieSearch from '$lib/components/search/movieSearch.svelte';

	const checks = [
		{
			id: 'bechdel',
			name: 'Bechdel Test',
			body: 'Do two named women in the film talk to each other about something other than a man? The result is a 0–3 score and applies to films only.',
			source: 'bechdeltest.com',
			href: 'https://bechdeltest.com'
		},
		{
			id: 'unconsenting',
			name: 'Unconsenting Media',
			body: 'Flags depictions of sexual violence in film. Nine fixed flags per title, drawn from a community dataset.',
			source: 'unconsentingmedia.org',
			href: 'https://www.unconsentingmedia.org'
		},
		{
			id: 'ddd',
			name: 'Does the Dog Die',
			body: 'Community trigger warnings across hundreds of categories, including animal deaths, self-harm, and eating disorders. Each one is decided by yes/no votes and fetched live per title.',
			source: 'doesthedogdie.com',
			href: 'https://www.doesthedogdie.com'
		}
	];

	const principles = [
		{
			title: 'Privacy first.',
			body: 'No trackers, no analytics, no ad pixels. The only tokens MIDB uses are the ones that fetch film data and run sign-in. Browsing activity is never recorded.'
		},
		{
			title: 'Open source.',
			body: 'The full source is public. Anyone can read it, fork it, or open a pull request.'
		},
		{
			title: 'Community funded.',
			body: 'MIDB takes no investment and sells nothing. It runs on contributions from the people who use it.'
		}
	];
</script>

<section class="hero">
	<h1 class="display" data-testid="hero-headline">Know before you&nbsp;watch.</h1>
	<p class="subhead">
		MIDB flags misogyny and violence against women in film and television, so you decide what's safe
		to watch.
	</p>
	<div class="search">
		<MovieSearch />
	</div>
</section>

<section class="band" aria-labelledby="checks-heading">
	<h2 id="checks-heading" class="display band-heading">What we check</h2>
	<div class="band-body">
		<dl class="checks">
			{#each checks as check (check.id)}
				<div class="check">
					<dt class="display check-name">{check.name}</dt>
					<dd>
						<p>{check.body}</p>
						<p class="check-links">
							<a class="link" href="/resources#{check.id}">How we use it</a>
							<a class="link" href={check.href} target="_blank" rel="noopener noreferrer"
								>{check.source}</a
							>
						</p>
					</dd>
				</div>
			{/each}
		</dl>
		<p class="note">
			We pull from established sources and combine them with ratings submitted by the MIDB
			community. Every title opens with a <a class="link" href="/resources#verdict">verdict</a> summarising
			safety and representation.
		</p>
	</div>
</section>

<section class="band" aria-labelledby="built-heading">
	<h2 id="built-heading" class="display band-heading">How MIDB is built</h2>
	<div class="band-body">
		<ul class="principles">
			{#each principles as p (p.title)}
				<li><strong>{p.title}</strong> {p.body}</li>
			{/each}
		</ul>
		<p class="note">
			The source lives on
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
		font-size: clamp(3rem, 10vw, 5.75rem);
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.015em;
		max-width: 12ch;
	}

	.subhead {
		@apply text-lg text-ink-muted;
		margin-top: var(--spacing-md);
		max-width: 36rem;
	}

	@media (min-width: 480px) {
		.subhead {
			@apply text-xl;
		}
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

	.checks {
		@apply flex flex-col;
	}

	.check {
		@apply flex flex-col gap-xs border-b border-border;
		padding-block: var(--spacing-md);
	}

	.check:first-child {
		padding-top: 0;
	}

	.check-name {
		@apply text-xl;
	}

	.check dd {
		@apply text-ink-muted;
	}

	.check-links {
		@apply flex flex-wrap gap-x-md text-sm;
		margin-top: var(--spacing-xs);
	}

	.note {
		@apply text-ink-muted;
		margin-top: var(--spacing-md);
	}

	.principles {
		@apply flex flex-col gap-md list-none m-0 p-0 text-ink-muted;
	}

	.principles strong {
		@apply text-ink font-semibold;
	}
</style>
