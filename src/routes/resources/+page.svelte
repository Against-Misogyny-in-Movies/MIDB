<script lang="ts">
	import ResourceNav from '#lib/components/resources/resourceNav.svelte';
	import MetricArticle from '#lib/components/resources/metricArticle.svelte';
	import SubBlock from '#lib/components/resources/subBlock.svelte';
	import BechdelLadderExample from '#lib/components/resources/bechdelLadderExample.svelte';
	import UmFlagsExample from '#lib/components/resources/umFlagsExample.svelte';
	import VerdictTierExample from '#lib/components/resources/verdictTierExample.svelte';

	const navItems = [
		{ id: 'verdict', label: 'Verdicts' },
		{ id: 'bechdel', label: 'Bechdel Test' },
		{ id: 'unconsenting', label: 'Unconsenting Media' },
		{ id: 'ddd', label: 'Does the Dog Die' },
		{ id: 'moderation', label: 'Moderation' }
	];
</script>

<svelte:head>
	<title>Methodology · MIDB</title>
	<meta
		name="description"
		content="MIDB scoring rules for content safety and representation, what the Bechdel Test, Unconsenting Media and Does the Dog Die measure, and how comments are moderated."
	/>
</svelte:head>

<div class="resources">
	<header class="page-head">
		<h1 class="display">Methodology</h1>
		<p class="lede">
			Each title page shows two verdicts, content safety and representation, built from the sources
			below. Comments are checked automatically before they appear.
		</p>
	</header>

	<div class="layout">
		<aside class="nav-col">
			<ResourceNav items={navItems} />
		</aside>

		<div class="content">
			<MetricArticle id="verdict" title="Verdicts" icon="ri-scales-3-fill" hue="var(--brand)">
				<p>
					Each verdict has three tiers, or Not enough data. The line under a verdict shows the
					number of metrics it used; opening it lists them. Verdicts are calculated from the data on
					the page and are not stored.
				</p>
				<VerdictTierExample />

				<SubBlock label="Content safety">
					<p>
						Uses the Unconsenting Media flags and the Does the Dog Die warnings, and takes the more
						severe result.
					</p>
					<p>
						<strong>Harmful content:</strong> Unconsenting Media flags rape on screen, rape off screen,
						attempted rape, child sexual abuse or incest, or a Does the Dog Die warning about rape, sexual
						assault, sexual abuse, molestation or incest has more yes votes than no votes.
					</p>
					<p>
						<strong>Watch with caution:</strong> no harmful flag, but Unconsenting Media flags on-screen
						sexual harassment, sexual content between an adult and a teenager, or rape that is mentioned
						or implied.
					</p>
					<p><strong>Safer to watch:</strong> neither source flags sexual violence.</p>
				</SubBlock>

				<SubBlock label="Representation">
					<p>
						Uses up to four signals: the share of women in the cast, in the top five billed, and in
						the key crew departments (directing, writing, production, editing and camera), plus the
						Bechdel Test rating for films.
					</p>
					<p>
						A share of 70% or more scores 2, 40% or more scores 1, lower scores 0. The Bechdel Test
						scores 2 for 3/3, 1 for 2/3 and 0 below. The scores are averaged: 1.75 or more is
						Strong, 1.0 or more is Mixed, lower is Poor. With fewer than two signals the verdict is
						Not enough data.
					</p>
				</SubBlock>
			</MetricArticle>

			<MetricArticle
				id="bechdel"
				title="Bechdel Test"
				icon="ri-chat-3-fill"
				hue="var(--src-bechdel)"
				sourceLabel="bechdeltest.com"
				sourceHref="https://bechdeltest.com"
			>
				<p>
					Whether a film has two named women who talk to each other about something other than a
					man. One point per step, from 0 to 3. Films only.
				</p>
				<BechdelLadderExample />
				<p>
					Ratings come from BechdelTest.com, a community site, and are used as published under the
					<a
						class="link"
						href="https://creativecommons.org/licenses/by-nc/3.0/"
						target="_blank"
						rel="noopener noreferrer">CC BY-NC 3.0</a
					> licence. New ratings and the last three years are copied daily, and every year weekly. A film's
					page shows the date of the last full copy beside the source link. The rating counts toward the
					representation verdict.
				</p>
			</MetricArticle>

			<MetricArticle
				id="unconsenting"
				title="Unconsenting Media"
				icon="ri-flag-2-fill"
				hue="var(--src-um)"
				sourceLabel="unconsentingmedia.org"
				sourceHref="https://www.unconsentingmedia.org"
			>
				<p>
					Nine flags for sexual violence on screen, from the Unconsenting Media community database.
					Eight mark a concern. The ninth, No rape or sexual assault, marks the absence of one and
					is not counted.
				</p>
				<UmFlagsExample />
				<p>
					Entries are copied daily. A title page with an entry shows the date of the last copy
					beside the source link. They are matched to titles by name and year. When several entries
					could match, the title page lists them. The choice applies to that page view only and is
					not saved.
				</p>
			</MetricArticle>

			<MetricArticle
				id="ddd"
				title="Does the Dog Die"
				icon="ri-alarm-warning-fill"
				hue="var(--src-ddd)"
				sourceLabel="doesthedogdie.com"
				sourceHref="https://www.doesthedogdie.com"
			>
				<p>
					Community trigger warnings on hundreds of topics, such as animal death, self-harm, blood
					and sexual content. Visitors vote yes or no on each topic for a title.
				</p>
				<p>
					A warning is shown when it has at least one yes vote and at least as many yes votes as no
					votes. The data is fetched from Does the Dog Die when a title page opens (films by IMDb
					id, series by title) and cached for one hour.
				</p>
			</MetricArticle>

			<MetricArticle
				id="moderation"
				title="Comments and moderation"
				icon="ri-shield-check-fill"
				hue="var(--brand)"
				sourceLabel="src/lib/server/moderation"
				sourceHref="https://github.com/Against-Misogyny-in-Movies/MIDB/tree/main/src/lib/server/moderation"
			>
				<p>
					Every new or edited comment is checked automatically before it can appear. The check, its
					policy and the blocklist are public in the site's source code.
				</p>

				<SubBlock label="Automatic check">
					<p>
						A short blocklist of words and phrases runs first. A match rejects the comment with no
						further check. The site also keeps a private list that extends it.
					</p>
					<p>
						Otherwise Claude Haiku 5.5, a model from Anthropic, reads the comment. Describing,
						quoting, analysing and criticising misogyny, sexual violence or other harm in a film or
						series is allowed, including a reader's own experience of it, and so are disagreement,
						harsh criticism of a film and strong language. Endorsing or celebrating misogyny or
						sexual violence, mocking or doubting survivors, attacking, insulting or harassing a
						person or a group, slurs, threats, sexual content involving minors, explicit sexual
						content, sharing personal information, and spam, advertising or links with no relation
						to the title are not. The model answers with a decision, the categories that apply, a
						severity from 0 to 3 and a reason.
					</p>
					<p>
						Anthropic receives the comment text, the title's name and, for a reply, the comment it
						answers. It never receives the author's email or account.
					</p>
				</SubBlock>

				<SubBlock label="Outcomes">
					<p>
						<strong>Published:</strong> the model allows the comment. It appears at once.
					</p>
					<p>
						<strong>Awaiting review:</strong> the model asks for a person to look, or finds a clear break
						below severity 2. The same applies when the check gives no verdict, or when the site has no
						key for it. Only the author and moderators see the comment until a moderator decides.
					</p>
					<p>
						<strong>Rejected:</strong> the blocklist matches, or the model finds a clear break of severity
						2 or 3. The author sees the comment with the reason.
					</p>
				</SubBlock>

				<SubBlock label="Reviewed by people">
					<p>
						Moderators approve, hide or reject comments from a queue. Three different readers
						reporting a published comment send it back to review. A moderator can also mute or ban
						an account.
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
		padding-top: clamp(2.5rem, 7vw, 4rem);
	}

	.page-head {
		max-width: 42rem;
	}

	h1 {
		font-size: clamp(2.25rem, 6vw, 3.75rem);
		line-height: 1;
		letter-spacing: -0.011em;
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
			top: 5rem;
		}
	}

	.content {
		@apply flex flex-col min-w-0;
		gap: 16px;
	}
</style>
