<footer>
	<div class="inner">
		<div class="brand">
			<span class="display wordmark">MIDB</span>
			<span class="label">Media Information Database</span>
		</div>
		<nav class="links label" aria-label="Footer">
			<a href="/">Home</a>
			<a href="/resources">Resources</a>
			<a href="/blog">Blog</a>
			<a href="/about">About us</a>
			<a href="/auth">Sign in</a>
		</nav>
	</div>
</footer>

<style lang="postcss">
	@reference "../../../app.css";

	footer {
		@apply border-t border-border mt-xl;
	}

	.inner {
		@apply flex items-center justify-between flex-wrap gap-md;
		@apply max-w-5xl mx-auto py-lg px-md;
	}

	.brand {
		@apply flex items-center gap-sm;
	}

	.wordmark {
		@apply text-brand font-semibold;
	}

	.links {
		@apply flex flex-wrap gap-md;
	}

	.links a {
		@apply text-ink-muted no-underline;
	}

	.links a:hover {
		@apply text-brand;
	}
</style>
