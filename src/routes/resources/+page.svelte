<script lang="ts">
  import ResourceNav from '$lib/components/resources/resourceNav.svelte';
  import MetricArticle from '$lib/components/resources/metricArticle.svelte';
  import SubBlock from '$lib/components/resources/subBlock.svelte';
  import BechdelLadderExample from '$lib/components/resources/bechdelLadderExample.svelte';
  import UmFlagsExample from '$lib/components/resources/umFlagsExample.svelte';
  import VerdictTierExample from '$lib/components/resources/verdictTierExample.svelte';
  import BackToTop from '$lib/components/ui/visualization/backToTop.svelte';

  const navItems = [
    { id: 'verdict', label: 'Verdict cards', icon: 'ri-compass-3-line' },
    { id: 'bechdel', label: 'Bechdel Test', icon: 'ri-scales-3-line' },
    { id: 'unconsenting', label: 'Unconsenting Media', icon: 'ri-shield-cross-line' },
    { id: 'ddd', label: 'Does the Dog Die', icon: 'ri-alarm-warning-line' }
  ];
</script>

<svelte:head>
  <title>How our metrics work — MIDB</title>
  <meta
    name="description"
    content="What the MIDB verdict cards, Bechdel Test, Unconsenting Media, and Does the Dog Die metrics mean, where the data comes from, and how we use it."
  />
</svelte:head>

<div class="resources">
  <header class="page-head">
    <p class="eyebrow display">Resources</p>
    <h1 class="display">How our metrics work</h1>
    <p class="lede">
      MIDB pulls together a few different sources to flag misogyny and violence against women in film
      and television. Here's what each metric measures, where the numbers come from, and how we use
      them.
    </p>
  </header>

  <div class="layout">
    <aside class="nav-col">
      <ResourceNav items={navItems} />
    </aside>

    <div class="content">
      <MetricArticle
        id="verdict"
        icon="ri-compass-3-line"
        title="Verdict cards"
        tagline="The at-a-glance summary"
      >
        <SubBlock label="What it is">
          <p>
            Two cards sit at the top of every title — one for content safety, one for representation.
            They give you the gist before you read the rest of the page.
          </p>
        </SubBlock>
        <SubBlock label="How it works">
          <p>
            Each card settles on a rating with a short label, plus a note telling you how many of its
            metrics it had to work with — so you know how much weight to put on it.
          </p>
          <VerdictTierExample />
        </SubBlock>
        <SubBlock label="Where it comes from">
          <p>
            Nothing here is stored. The cards are worked out in your browser from the metrics already
            on the page: the Unconsenting Media flags, the Does the Dog Die tags, the Bechdel rating,
            and the cast and crew gender split from TMDB.
          </p>
        </SubBlock>
        <SubBlock label="How we work it out">
          <p>
            Safety takes the worst signal it finds. On-screen, off-screen, or attempted rape, child
            sexual abuse, and incest push it to Harmful. Harassment, adult–teen relationships, and
            rape that's mentioned or implied push it to Watch with caution. A community trigger tag
            about sexual violence can raise it to Harmful on its own.
          </p>
          <p>
            Representation averages up to four numbers: the share of women in the full cast, among the
            top five billed, and in the key crew departments (directing, writing, production, editing,
            camera), plus the Bechdel rating. We need at least two of those, or the card just says it
            doesn't have enough to go on.
          </p>
        </SubBlock>
      </MetricArticle>

      <MetricArticle
        id="bechdel"
        icon="ri-scales-3-line"
        title="Bechdel Test"
        tagline="Do two women talk about something other than a man?"
        sourceLabel="bechdeltest.com"
        sourceHref="https://bechdeltest.com"
      >
        <SubBlock label="What it is">
          <p>
            A rough 0–3 score for whether a movie lets two named women talk to each other about
            anything other than a man.
          </p>
        </SubBlock>
        <SubBlock label="How it works">
          <p>Three steps, each building on the last:</p>
          <BechdelLadderExample />
        </SubBlock>
        <SubBlock label="Where it comes from">
          <p>
            The ratings come from BechdelTest.com, a long-running community project. We load them into
            our database when we seed it. It's a movies-only test, so you won't see it on series.
          </p>
        </SubBlock>
        <SubBlock label="How we work it out">
          <p>
            We don't change the rating — we just show which steps a film passed. The result also feeds
            into the representation card.
          </p>
        </SubBlock>
      </MetricArticle>

      <MetricArticle
        id="unconsenting"
        icon="ri-shield-cross-line"
        title="Unconsenting Media"
        tagline="Flags for sexual violence on screen"
        sourceLabel="unconsentingmedia.org"
        sourceHref="https://www.unconsentingmedia.org"
      >
        <SubBlock label="What it is">
          <p>
            A checklist of nine flags about sexual violence on screen. One of them is the reassuring
            one: "No rape or sexual assault."
          </p>
        </SubBlock>
        <SubBlock label="How it works">
          <p>
            Every flag is either present or not. The reassuring flag shows green when it applies; the
            other eight are concerns. The count you see ignores the reassuring flag and tallies the
            rest.
          </p>
          <UmFlagsExample />
        </SubBlock>
        <SubBlock label="Where it comes from">
          <p>
            The flags come from the Unconsenting Media dataset, matched to each title by name and year
            when we seed the database. When a title is ambiguous, we show you the possible matches and
            let you pick the right one — that choice stays in your browser and isn't saved.
          </p>
        </SubBlock>
        <SubBlock label="How we work it out">
          <p>
            Each title gets one record, shown as the nine flags. The serious ones feed straight into
            the safety card.
          </p>
        </SubBlock>
      </MetricArticle>

      <MetricArticle
        id="ddd"
        icon="ri-alarm-warning-line"
        title="Does the Dog Die"
        tagline="Community trigger warnings"
        sourceLabel="doesthedogdie.com"
        sourceHref="https://www.doesthedogdie.com"
      >
        <SubBlock label="What it is">
          <p>
            Community-written trigger warnings — "does a dog die?", "is there blood?", and hundreds
            more, across categories like animal harm, violence, and sexual content.
          </p>
        </SubBlock>
        <SubBlock label="How it works">
          <p>
            People vote yes or no on whether each thing happens. We only show a warning once the crowd
            agrees it does: at least as many yes votes as no, and at least one yes.
          </p>
        </SubBlock>
        <SubBlock label="Where it comes from">
          <p>
            We pull this live from the Does the Dog Die API every time you open a title — movies by
            their IMDb id, series by title and year. We cache it for about an hour and don't store it
            ourselves. It loads in just after the page does, so it never holds up the rest.
          </p>
        </SubBlock>
        <SubBlock label="How we work it out">
          <p>
            We keep the agreed-on warnings, sort them by how strong the vote is, and group them by
            category. Warnings about sexual violence can also raise the safety card.
          </p>
        </SubBlock>
      </MetricArticle>
    </div>
  </div>

  <BackToTop />
</div>

<style lang="postcss">
  @reference "../../app.css";

  .resources {
    @apply flex flex-col py-xl;
    gap: var(--spacing-xl);
  }

  .page-head {
    max-width: 46rem;
  }

  .eyebrow {
    @apply text-brand text-lg;
    font-style: italic;
  }

  h1 {
    @apply text-4xl font-semibold text-ink mt-xs mb-md;
    letter-spacing: -0.01em;
    line-height: 1.05;
  }

  @media (min-width: 480px) {
    h1 {
      @apply text-5xl;
    }
  }

  .lede {
    @apply text-ink-muted text-lg leading-relaxed;
    max-width: 40rem;
  }

  .layout {
    @apply grid gap-lg items-start;
    grid-template-columns: 1fr;
    /* Let the single-column track shrink so the chip row can scroll inside it
       instead of widening the page. */
    min-width: 0;
  }

  @media (min-width: 768px) {
    .layout {
      grid-template-columns: 14rem minmax(0, 1fr);
      gap: var(--spacing-xl);
    }
  }

  .nav-col,
  .content {
    min-width: 0;
  }

  .content {
    @apply flex flex-col gap-md;
  }

  /* The grid item itself is the sticky element (the grid uses items: start, so
     the cell is only as tall as the nav and an inner sticky child would have no
     room to pin). Desktop pins below the navbar; mobile pins at the top. */
  .nav-col {
    @apply sticky;
    top: 5rem;
    z-index: 5;
  }

  @media (max-width: 767px) {
    .nav-col {
      /* Pin a little below the top so the chip bar keeps breathing room above
         it while scrolling. The container stays transparent — the page shows
         through the gaps between chips; the chips themselves are opaque. */
      position: sticky;
      top: var(--spacing-md);
    }
  }
</style>
