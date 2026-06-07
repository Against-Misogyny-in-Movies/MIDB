<script lang="ts">
	import HeroSearch from '$lib/components/landing/heroSearch.svelte';
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
			<p>Do two named women in the film talk to each other about something other than a man?</p>
			<a
				class="source-link"
				href="https://bechdeltest.com"
				target="_blank"
				rel="noopener noreferrer">bechdeltest.com ↗</a
			>
		</div>
		<div>
			<h3 class="display">Unconsenting Media</h3>
			<p>
				Flags sexual violence in film, for survivors or anyone who just wants to know before they
				sit down.
			</p>
			<a
				class="source-link"
				href="https://www.unconsentingmedia.org"
				target="_blank"
				rel="noopener noreferrer">unconsentingmedia.org ↗</a
			>
		</div>
		<div>
			<h3 class="display">Does The Dog Die</h3>
			<p>
				Community warnings for the things mainstream ratings miss: animal deaths, self-harm, eating
				disorders, and more.
			</p>
			<a
				class="source-link"
				href="https://www.doesthedogdie.com"
				target="_blank"
				rel="noopener noreferrer">doesthedogdie.com ↗</a
			>
		</div>
	</div>
	<p class="metrics-note">
		We pull from established sources and combine them with ratings submitted by the MIDB community.
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

	.source-link {
		@apply text-brand no-underline text-xs mt-xs inline-block;
	}

	.source-link:hover {
		@apply text-brand-strong;
	}
</style>
