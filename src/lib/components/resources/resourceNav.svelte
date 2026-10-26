<script lang="ts">
	interface Item {
		id: string;
		label: string;
	}

	interface Props {
		items: Item[];
	}

	let { items }: Props = $props();

	// Seeded to the first section; the scroll handler below keeps it in sync.
	let active = $state('');
	let activeOrFirst = $derived(active || (items[0]?.id ?? ''));

	// Active = the last section whose top has scrolled past a line near the viewport top.
	// Computing from rects stays accurate for tall and short sections alike.
	$effect(() => {
		const sections = items
			.map((i) => document.getElementById(i.id))
			.filter((el): el is HTMLElement => el !== null);
		if (sections.length === 0) return;

		function update() {
			// At the bottom, the last section can't reach the line: pin it active.
			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			if (atBottom) {
				active = sections[sections.length - 1].id;
				return;
			}
			const trigger = 96;
			let current = sections[0].id;
			for (const section of sections) {
				if (section.getBoundingClientRect().top - trigger <= 0) current = section.id;
			}
			active = current;
		}

		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});
</script>

<nav class="resource-nav" aria-label="On this page">
	<p class="label heading">On this page</p>
	<ul>
		{#each items as item (item.id)}
			<li>
				<a
					href={`#${item.id}`}
					class:active={activeOrFirst === item.id}
					aria-current={activeOrFirst === item.id ? 'true' : undefined}
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style lang="postcss">
	@reference "../../../app.css";

	.heading {
		@apply text-xs font-medium;
		margin-bottom: var(--spacing-sm);
		padding-inline: 12px;
	}

	@media (max-width: 767px) {
		.heading {
			padding-inline: 0;
		}
	}

	ul {
		@apply flex flex-col list-none m-0 p-0;
	}

	a {
		@apply block text-sm font-medium text-ink-muted no-underline;
		padding: 6px 12px;
		border-radius: 8px;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	a:hover {
		@apply text-ink;
	}

	a.active {
		color: var(--brand);
		background-color: var(--brand-wash);
	}

	/* Phones: a plain list of the four sections under the intro; nothing pins. */
	@media (max-width: 767px) {
		ul {
			@apply flex-row flex-wrap gap-x-md;
		}

		a {
			padding-inline: 0;
		}

		a.active {
			color: var(--ink-muted);
			background-color: transparent;
		}
	}
</style>
