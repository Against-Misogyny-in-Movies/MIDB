<div class="relative h-hero">
	<div class="background" />
	<div class="title-container">
		<div class="title-content">
			<h1>Misogyny_DB</h1>
			<p class="subtitle">Like IMDB but calling out misogyny in the film industry.</p>
			<button> Add an entry </button>
		</div>
	</div>
	<img
		src="https://images.mubicdn.net/images/film/382/cache-32059-1546815620/image-w1280.jpg?size=1200x"
		alt="hero"
	/>
</div>

<style lang="postcss">
	.background {
		@apply absolute z-10 bg-gradient-to-r from-white dark:from-gray dark:opacity-100 opacity-100 w-full h-full;
	}
	button {
		@apply transition-all duration-100 ease-in-out transform hover:-translate-y-xs hover:scale-105;
		@apply flex items-center justify-center  p-sm w-[13rem];
		@apply font-medium rounded-md shadow-xl mt-md text-lg;
		@apply bg-gradient-to-r dark:from-sky-light dark:to-pink from-pink to-violet-dark;
	}

	.title-container {
		@apply absolute z-20 pt-4xl w-full h-full;
	}

	.title-content {
		@apply flex flex-col gap-y-md p-lg max-w-7xl mx-auto;
	}

	h1 {
		@apply sm:text-5xl text-4xl font-bold tracking-tight;
	}

	.subtitle {
		@apply sm:text-xl text-base font-semibold pt-md text-neutral-dark dark:text-gray-light mb-lg;
	}

	img {
		@apply w-full h-full relative z-0 object-cover;
	}
</style>
