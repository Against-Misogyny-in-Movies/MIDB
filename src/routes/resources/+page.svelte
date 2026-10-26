<script lang="ts">
	import ResourceNav from '$lib/components/resources/resourceNav.svelte';
	import MetricArticle from '$lib/components/resources/metricArticle.svelte';
	import SubBlock from '$lib/components/resources/subBlock.svelte';
	import BechdelLadderExample from '$lib/components/resources/bechdelLadderExample.svelte';
	import UmFlagsExample from '$lib/components/resources/umFlagsExample.svelte';
	import VerdictTierExample from '$lib/components/resources/verdictTierExample.svelte';

	const navItems = [
		{ id: 'verdict', label: 'Verdict cards' },
		{ id: 'bechdel', label: 'Bechdel Test' },
		{ id: 'unconsenting', label: 'Unconsenting Media' },
		{ id: 'ddd', label: 'Does the Dog Die' }
	];
</script>

<svelte:head>
	<title>How our metrics work · MIDB</title>
	<meta
		name="description"
		content="What the MIDB verdict cards, Bechdel Test, Unconsenting Media, and Does the Dog Die metrics mean, where the data comes from, and how we use it."
	/>
</svelte:head>

<div class="resources">
	<header class="page-head">
		<h1 class="display">How our metrics work</h1>
		<p class="lede">
			MIDB combines several sources to flag misogyny and violence against women in film and
			television. This page covers what each metric measures, where its data comes from, and how it
			is used.
		</p>
	</header>

	<div class="layout">
		<aside class="nav-col">
			<ResourceNav items={navItems} />
		</aside>

		<div class="content">
			<MetricArticle
				id="verdict"
				title="Verdict cards"
				tagline="The summary at the top of every title"
			>
				<SubBlock label="What it is">
					<p>
						Verdict cards are the page's at-a-glance summary. Every title opens with two of them,
						one for content safety and one for representation, each distilling the metrics further
						down the page into a single tier so the overall picture is clear before reading any
						detail.
					</p>
				</SubBlock>
				<SubBlock label="How it works">
					<p>
						Each card resolves to one of three tiers, plus a fourth "not enough data" state when too
						few metrics are available. The line under the summary shows how many metrics went into
						the rating; opening it lists each one.
					</p>
					<VerdictTierExample />
				</SubBlock>
				<SubBlock label="Where it comes from">
					<p>
						Nothing here is stored. The cards are computed in the browser from metrics already on
						the page: the Unconsenting Media flags, the Does the Dog Die tags, the Bechdel rating,
						and the cast and crew gender breakdown from TMDB.
					</p>
				</SubBlock>
				<SubBlock label="How safety is scored">
					<p>
						Safety reads two sources, the Unconsenting Media flags and the Does the Dog Die tags,
						and takes the most severe result. With neither source available, the card reads "not
						enough data".
					</p>
					<p>
						Five Unconsenting Media flags set the tier to Harmful: rape on screen, rape off screen,
						attempted rape, child sexual abuse, and incest. Three set it to Watch with caution when
						no harmful flag is present: on-screen sexual harassment, adult–teen sexual content, and
						rape that is only mentioned or implied.
					</p>
					<p>
						Does the Dog Die can raise the tier but never lower it. A community tag naming rape,
						sexual assault, sexual abuse, molestation, or incest, with more yes votes than no votes,
						raises the card to Harmful on its own.
					</p>
				</SubBlock>
				<SubBlock label="How representation is scored">
					<p>
						Representation draws on up to four signals: the share of women in the full cast, the
						share among the top five billed, the share across the key crew departments (directing,
						writing, production, editing, and camera), and the Bechdel rating. Series have no
						Bechdel rating, so they use the first three.
					</p>
					<p>
						Each signal scores 0, 1, or 2. A gender share of 70% or more scores 2, 40% or more
						scores 1, and anything lower scores 0. The Bechdel rating maps 3/3 to 2, 2/3 to 1, and
						below that to 0. Fewer than two available signals reads "not enough data".
					</p>
					<p>
						The available scores are averaged. An average of 1.75 or above is Strong representation,
						1.0 or above is Mixed, and below that is Poor.
					</p>
				</SubBlock>
			</MetricArticle>

			<MetricArticle
				id="bechdel"
				title="Bechdel Test"
				tagline="Do two women talk about something other than a man?"
				sourceLabel="bechdeltest.com"
				sourceHref="https://bechdeltest.com"
			>
				<SubBlock label="What it is">
					<p>
						A 0–3 score for whether two named women in a film talk to each other about something
						other than a man.
					</p>
				</SubBlock>
				<SubBlock label="How it works">
					<p>Three criteria, each building on the one before it:</p>
					<BechdelLadderExample />
				</SubBlock>
				<SubBlock label="Where it comes from">
					<p>
						The ratings come from BechdelTest.com, a community project. They are loaded into the
						database during seeding. The test applies to films only, so it does not appear on
						series.
					</p>
				</SubBlock>
				<SubBlock label="How we work it out">
					<p>
						The rating is used as published. The title page shows which criteria a film passed, and
						the score feeds into the representation verdict.
					</p>
				</SubBlock>
			</MetricArticle>

			<MetricArticle
				id="unconsenting"
				title="Unconsenting Media"
				tagline="Flags for sexual violence on screen"
				sourceLabel="unconsentingmedia.org"
				sourceHref="https://www.unconsentingmedia.org"
			>
				<SubBlock label="What it is">
					<p>
						A set of nine flags covering sexual violence on screen. Eight mark a concern; the ninth,
						"No rape or sexual assault", is the absence of one.
					</p>
				</SubBlock>
				<SubBlock label="How it works">
					<p>
						Each flag is either present or absent. The "No rape or sexual assault" flag shows green
						when it applies. The concern count tallies the other eight and ignores it.
					</p>
					<UmFlagsExample />
				</SubBlock>
				<SubBlock label="Where it comes from">
					<p>
						The flags come from the Unconsenting Media dataset, matched to each title by name and
						year during seeding. When a title is ambiguous, the page lists the possible matches to
						choose from. That choice stays in the browser and is not saved.
					</p>
				</SubBlock>
				<SubBlock label="How we work it out">
					<p>
						Each title resolves to one record of nine flags. Five of them feed into the safety
						verdict as harmful, and three as caution.
					</p>
				</SubBlock>
			</MetricArticle>

			<MetricArticle
				id="ddd"
				title="Does the Dog Die"
				tagline="Community trigger warnings"
				sourceLabel="doesthedogdie.com"
				sourceHref="https://www.doesthedogdie.com"
			>
				<SubBlock label="What it is">
					<p>
						Community-written trigger warnings: "does a dog die?", "is there blood?", and hundreds
						more, across categories such as animal harm, violence, and sexual content.
					</p>
				</SubBlock>
				<SubBlock label="How it works">
					<p>
						People vote yes or no on whether each thing happens. A warning is shown only when the
						yes votes are at least equal to the no votes, with at least one yes.
					</p>
				</SubBlock>
				<SubBlock label="Where it comes from">
					<p>
						The data is fetched live from the Does the Dog Die API when a title opens: films by IMDb
						id, series by title and year. It is cached for about an hour and not stored otherwise.
						It loads just after the page, so it does not block the rest of the content.
					</p>
				</SubBlock>
				<SubBlock label="How we work it out">
					<p>
						The confirmed warnings are sorted by margin of the vote and grouped by category. A
						warning naming sexual violence can raise the safety verdict to Harmful, as described
						under verdict cards.
					</p>
				</SubBlock>
			</MetricArticle>
		</div>
	</div>
</div>

<style lang="postcss">
	@reference "../../app.css";

	/* Smooth-scroll the in-page anchors on this route only: the rule mounts and unmounts with
	   the page. */
	:global(html:has(.resources)) {
		scroll-behavior: smooth;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(html:has(.resources)) {
			scroll-behavior: auto;
		}
	}

	.resources {
		@apply flex flex-col;
		gap: var(--spacing-xl);
		padding-top: var(--spacing-xl);
	}

	.page-head {
		max-width: 42rem;
	}

	h1 {
		font-size: clamp(2.5rem, 7vw, 4rem);
		font-weight: 800;
	}

	.lede {
		@apply text-lg text-ink-muted;
		margin-top: var(--spacing-md);
	}

	.layout {
		@apply grid gap-lg items-start;
		grid-template-columns: minmax(0, 1fr);
	}

	@media (min-width: 768px) {
		.layout {
			grid-template-columns: 12rem minmax(0, 42rem);
			gap: var(--spacing-xl);
		}

		/* The grid cell is only as tall as the nav (items: start), so the cell itself pins. */
		.nav-col {
			@apply sticky;
			top: var(--spacing-lg);
		}
	}

	.content {
		@apply flex flex-col min-w-0;
	}
</style>
