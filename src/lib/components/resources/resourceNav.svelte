<script lang="ts">
	interface Item {
		id: string;
		label: string;
		icon: string;
	}

	interface Props {
		items: Item[];
	}

	let { items }: Props = $props();

	// Seeded to the first section; the observer below keeps it in sync on scroll.
	let active = $state('');
	let activeOrFirst = $derived(active || (items[0]?.id ?? ''));

	// Active = the last section whose top has scrolled past a trigger line just
	// below the sticky bar. Computing from rects (rather than relying on a narrow
	// IntersectionObserver band) stays accurate for tall and short sections alike.
	$effect(() => {
		const sections = items
			.map((i) => document.getElementById(i.id))
			.filter((el): el is HTMLElement => el !== null);
		if (sections.length === 0) return;

		function update() {
			// When scrolled to the bottom, the last section can't reach the trigger
			// line — pin it active so the final item always highlights.
			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			if (atBottom) {
				active = sections[sections.length - 1].id;
				return;
			}
			const trigger = 96; // px from viewport top, clears the sticky chip row
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

<nav class="resource-nav" aria-label="Sections">
	<ul class="nav-list">
		{#each items as item (item.id)}
			<li>
				<a
					href={`#${item.id}`}
					class="nav-link"
					class:nav-link--active={activeOrFirst === item.id}
					aria-current={activeOrFirst === item.id ? 'true' : undefined}
				>
					<i class={item.icon} aria-hidden="true"></i>
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style lang="postcss">
	@reference "../../../app.css";

	/* Stickiness is owned by the .nav-col grid item on the page (the cell is short
     under items: start, so the wrapper is what pins). */
	.resource-nav {
		@apply static;
	}

	.nav-list {
		@apply flex flex-col gap-xs list-none m-0 p-0;
	}

	.nav-link {
		@apply flex items-center gap-sm text-sm text-ink-muted no-underline rounded-md;
		padding: var(--spacing-xs) var(--spacing-sm);
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.nav-link:hover {
		@apply text-brand;
	}

	.nav-link--active {
		background-color: color-mix(in oklab, var(--brand) 16%, transparent);
		color: var(--brand);
		@apply font-medium;
	}

	/* Below md the nav becomes a horizontal chip row (the .nav-col wrapper owns
     the sticky behaviour). Chips are icon-only so all four fit one line without
     scrolling; the active chip reveals its label to anchor where you are. */
	@media (max-width: 767px) {
		.resource-nav {
			@apply py-sm;
			min-width: 0;
		}

		.nav-list {
			@apply flex-row items-center justify-between;
			gap: var(--spacing-xs);
		}

		/* Opaque fill on the <li> so content scrolling behind the transparent
       sticky container doesn't bleed through the chips. */
		.nav-list > li {
			@apply min-w-0 rounded-md flex;
			background-color: var(--surface-raised);
			box-shadow:
				0 4px 12px color-mix(in oklab, var(--brand) 14%, transparent),
				0 1px 2px color-mix(in oklab, var(--ink) 8%, transparent);
		}

		/* The list item holding the active chip grows so its label fits. */
		.nav-list > li:has(.nav-link--active) {
			@apply flex-1;
		}

		.nav-link {
			@apply whitespace-nowrap border border-border justify-center w-full;
			min-width: 0;
		}

		/* Hide labels visually but keep them for assistive tech. */
		.nav-link span {
			@apply sr-only;
		}

		.nav-link--active {
			border-color: color-mix(in oklab, var(--brand) 35%, var(--border));
			/* Opaque base + brand tint keeps the active chip readable over scroll. */
			background-color: color-mix(in oklab, var(--brand) 16%, var(--surface-raised));
			/* Active chip flexes to fit its revealed label; others stay icon-sized. */
			@apply flex-1;
		}

		/* Reveal the active chip's label inline. */
		.nav-link--active span {
			@apply not-sr-only truncate;
		}
	}
</style>
