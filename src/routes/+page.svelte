<script lang="ts">
	import HeroSearch from '$lib/components/landing/heroSearch.svelte';

	const principles = [
		{
			icon: 'ri-shield-keyhole-line',
			title: 'Privacy first',
			body: 'No trackers, no analytics, no ad pixels. The only tokens MIDB uses are the ones that fetch film data and run sign-in. Browsing activity is never recorded.'
		},
		{
			icon: 'ri-git-repository-line',
			title: 'Open source',
			body: 'The full source is public. Anyone can read it, fork it, or open a pull request.'
		},
		{
			icon: 'ri-hand-heart-line',
			title: 'Community funded',
			body: 'MIDB takes no investment and sells nothing. It runs on contributions from the people who use it.'
		}
	];
</script>

<section class="hero">
	<p class="eyebrow display">A film &amp; TV safety reference</p>
	<h1 class="display" data-testid="hero-headline">Know before you&nbsp;watch.</h1>
	<p class="subhead">
		MIDB flags <strong>misogyny and violence against women</strong> in film and television, so you decide
		what's safe to watch.
	</p>
	<div class="search-wrap">
		<HeroSearch />
	</div>
	<p class="contribute">
		<a href="/auth" data-testid="contribute-link">Rate a film yourself →</a>
	</p>
</section>

<section class="metrics">
	<p class="metrics-label label">What we check</p>
	<div class="metrics-grid">
		<div>
			<h3 class="display">Bechdel Test</h3>
			<p>
				Do two named women in the film talk to each other about something other than a man? The
				result is a 0–3 score and applies to films only.
			</p>
			<div class="card-links">
				<a class="learn-link" href="/resources#bechdel">How we use it →</a>
				<a
					class="source-link"
					href="https://bechdeltest.com"
					target="_blank"
					rel="noopener noreferrer">bechdeltest.com ↗</a
				>
			</div>
		</div>
		<div>
			<h3 class="display">Unconsenting Media</h3>
			<p>
				Flags depictions of sexual violence in film. Nine fixed flags per title, drawn from a
				community dataset.
			</p>
			<div class="card-links">
				<a class="learn-link" href="/resources#unconsenting">How we use it →</a>
				<a
					class="source-link"
					href="https://www.unconsentingmedia.org"
					target="_blank"
					rel="noopener noreferrer">unconsentingmedia.org ↗</a
				>
			</div>
		</div>
		<div>
			<h3 class="display">Does The Dog Die</h3>
			<p>
				Community trigger warnings across hundreds of categories, including animal deaths,
				self-harm, and eating disorders. Each one is decided by yes/no votes and fetched live per
				title.
			</p>
			<div class="card-links">
				<a class="learn-link" href="/resources#ddd">How we use it →</a>
				<a
					class="source-link"
					href="https://www.doesthedogdie.com"
					target="_blank"
					rel="noopener noreferrer">doesthedogdie.com ↗</a
				>
			</div>
		</div>
	</div>
	<p class="metrics-note">
		We pull from established sources and combine them with ratings submitted by the MIDB community.
		Every title opens with a <a href="/resources#verdict">verdict card</a> summarising safety and representation.
	</p>
</section>

<section class="principles">
	<p class="principles-label label">How MIDB is built</p>
	<div class="principles-grid">
		{#each principles as p (p.title)}
			<div class="principle">
				<span class="principle-icon" aria-hidden="true"><i class={p.icon}></i></span>
				<h3 class="display">{p.title}</h3>
				<p>{p.body}</p>
			</div>
		{/each}
	</div>
	<p class="principles-note">
		The source lives on
		<a
			href="https://github.com/Against-Misogyny-in-Movies/MIDB"
			target="_blank"
			rel="noopener noreferrer">GitHub ↗</a
		>.
	</p>
</section>

<style lang="postcss">
	@reference "../app.css";

	.hero {
		@apply mt-xl;
		max-width: 46rem;
		margin-bottom: 5rem;
		padding-bottom: 3rem;
	}

	.eyebrow {
		@apply text-brand text-lg;
		font-style: italic;
	}

	h1 {
		@apply text-5xl font-semibold text-ink mt-md mb-md;
		letter-spacing: -0.01em;
		line-height: 1.05;
	}

	@media (min-width: 480px) {
		h1 {
			@apply text-6xl;
		}
	}

	.subhead {
		@apply text-ink-muted text-lg mb-lg leading-relaxed;
		max-width: 38rem;
	}

	@media (min-width: 480px) {
		.subhead {
			@apply text-xl;
		}
	}

	.subhead strong {
		@apply text-ink font-semibold;
	}

	.search-wrap {
		@apply w-full;
		max-width: 34rem;
	}

	.contribute {
		@apply flex flex-wrap items-center gap-xs text-ink-muted mt-md text-sm;
	}

	.contribute a {
		@apply text-brand no-underline;
	}

	.contribute a:hover {
		@apply text-brand-strong;
	}

	.metrics {
		@apply border-t border-border pt-xl pb-xl;
	}

	.metrics-label {
		@apply mb-lg block;
	}

	.metrics-grid {
		@apply grid grid-cols-1 gap-lg;
	}

	@media (min-width: 768px) {
		.metrics-grid {
			@apply grid-cols-3;
		}
	}

	.metrics h3 {
		@apply text-brand font-semibold mb-xs text-lg;
	}

	.metrics p {
		@apply text-ink-muted text-sm;
	}

	.metrics-note {
		@apply text-ink-muted text-sm mt-lg pt-lg border-t border-border;
		max-width: 42rem;
	}

	.metrics-note a {
		@apply text-brand no-underline font-medium;
	}

	.metrics-note a:hover {
		@apply text-brand-strong;
	}

	.card-links {
		@apply flex flex-wrap items-center gap-md mt-xs;
	}

	.source-link,
	.learn-link {
		@apply text-brand no-underline text-xs inline-block;
	}

	.source-link:hover,
	.learn-link:hover {
		@apply text-brand-strong;
	}

	.learn-link {
		@apply font-medium;
	}

	.principles {
		@apply border-t border-border pt-xl pb-xl;
	}

	.principles-label {
		@apply mb-lg block;
	}

	.principles-grid {
		@apply grid grid-cols-1 gap-lg;
	}

	@media (min-width: 768px) {
		.principles-grid {
			@apply grid-cols-3;
		}
	}

	.principle {
		@apply rounded-md border border-border bg-surface-raised p-md;
	}

	.principle-icon {
		@apply flex items-center justify-center rounded-full text-lg mb-sm;
		width: 2rem;
		height: 2rem;
		background-color: color-mix(in oklab, var(--brand) 16%, transparent);
		color: var(--brand);
	}

	.principles h3 {
		@apply text-ink font-semibold mb-xs text-lg;
	}

	.principles p {
		@apply text-ink-muted text-sm leading-relaxed;
	}

	.principles-note {
		@apply text-ink-muted text-sm mt-lg pt-lg border-t border-border;
		max-width: 42rem;
	}

	.principles-note a {
		@apply text-brand no-underline font-medium;
	}

	.principles-note a:hover {
		@apply text-brand-strong;
	}
</style>
