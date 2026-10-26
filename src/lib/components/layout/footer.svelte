<footer>
	<div class="inner">
		<p class="line">
			<a href="/" class="wordmark">MIDB</a>
			<a href="/resources">Methodology</a>
			<a
				href="https://github.com/Against-Misogyny-in-Movies/MIDB"
				target="_blank"
				rel="noopener noreferrer">Source code</a
			>
		</p>
		<p class="credit">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
	</div>
</footer>

<style lang="postcss">
	@reference "../../../app.css";

	footer {
		@apply border-t border-border;
		margin-top: 5rem;
	}

	.inner {
		@apply flex flex-col gap-sm max-w-5xl mx-auto px-md text-sm text-ink-muted;
		padding-block: var(--spacing-lg);
	}

	.line {
		@apply flex flex-wrap items-baseline gap-x-md gap-y-xs;
	}

	.line a {
		@apply no-underline;
		transition: color 0.15s ease;
	}

	.line a:not(.wordmark):hover {
		@apply text-ink;
	}

	.wordmark {
		padding: 2px 10px;
		border-radius: 9999px;
		background-color: var(--ink);
		color: var(--on-ink);
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 700;
	}

	.credit {
		@apply text-xs;
		max-width: 40rem;
	}
</style>
