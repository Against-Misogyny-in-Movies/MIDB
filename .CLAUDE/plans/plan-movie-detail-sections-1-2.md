# Movie Detail Page — Sections 1 & 2

## Context

MIDB is a film-safety / representation reference: users search for a movie and view it
through a "diversity lens" (Bechdel Test, etc.). Today, selecting a search result navigates
to `/movie/[movieId]`, which renders a single `<MovieTile>` (poster + title + date + overview)
and a `?metrics`/`?cast` query-param `SimpleNav` where the **Cast link goes nowhere** (known
gap #4) and the detail fetch is **unauthenticated and minimal** (known gap #6).

We are building out the real movie detail page as a **single scrolling page** with four
planned sections: (1) general details, (2) cast/crew gender distribution, (3) metrics,
(4) comments. **This plan covers only sections 1 & 2.** Sections 3 & 4 are deferred to a
later plan; this plan leaves clean anchored placeholders for them.

The design should stay minimal and editorial — matching the landing page: Fraunces display
serif for headings (`.display`), tiny uppercase tracked `.label`s, generous spacing, brand
purple + aqua accent, calm vertical rhythm. This is a representation page, so color choices
in the gender chart must be neutral and not imply value judgments.

Decisions confirmed with the user:
- **Layout:** single scrolling page.
- **Data fetch:** authenticated (`Bearer ${TMDB_API_TOKEN}`) + `append_to_response=credits`
  so movie details *and* cast/crew arrive in one request (also fixes known gap #6).

---

## 1. Data layer

### `src/routes/movie/[movieId]/datasource.server.ts` (rewrite `getMovie`)
- Switch from `joinPath` to `new URL(\`${PUBLIC_TMDB_API_URL}/3/movie/${movieId}\`)` so we can
  add query params. Set `append_to_response=credits` and `language=en-US`.
- Add headers `Authorization: Bearer ${TMDB_API_TOKEN}` (import from `$env/static/private`) and
  `accept: application/json` — mirror `src/routes/api/search/datasource.server.ts`.
- Add a `!response.ok` guard: `throw error(response.status, ...)` from `@sveltejs/kit` so the
  default error page renders instead of crashing on `data.movie`.
- Map the new fields onto an extended `Movie` shape (snake → camel, matching existing style):
  `budget`, `revenue` (raw ints), `genres` (`{id,name}[]`), `originCountry` (`string[]`),
  `originalLanguage` (string), `spokenLanguages` (`{iso, englishName}[]` from
  `iso_639_1`/`english_name`), `runtime`, `tagline`. Type `posterPath` as `string | null`.
- **Aggregate gender counts server-side** (cast+crew can be ~225 entries — don't ship them all
  just to count). Reduce `data.credits?.cast ?? []` and `?.crew ?? []` over the `gender` int
  (0=unknown, 1=female, 2=male, 3=non-binary) into a `GenderBreakdown`
  (`{ unknown, female, male, nonBinary, total }`). Add `cast` and `crew` of this type to `Movie`.
  Keep the reduce in a small named helper so a later (sections 3/4) raw-credits field can coexist.

### `src/routes/movie/[movieId]/types.ts` (new, non-server)
Move the `Movie` and `GenderBreakdown` interfaces here (mirrors how `search/types.ts` is split
from `search/datasource.server.ts`). The datasource imports + re-exports them; client components
import the types from here, never from `*.server.ts`.

### `src/routes/movie/[movieId]/+page.server.ts`
No structural change — it already calls `getMovie`. Keep the `Promise.all` wrapper and add a
`// TODO(sections 3/4)` comment marking where the metrics (Postgres) and comments loads will go.

### `src/lib/movie/format.ts` (new, plain TS — client-safe, `Intl` only)
Pure helpers, unit-testable (precedent: `radioTile.spec.ts`):
- `formatCurrency(n)` → `Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})`; returns `'—'` when `n` is 0/falsy (TMDB uses 0 = unknown).
- `countryName(iso)` / `languageName(iso)` → `Intl.DisplayNames`, wrapped in try/catch with a
  fallback to the raw code (or `englishName` for languages — some TMDB ISO codes aren't valid 639-1).
- `formatRuntime(min)` → `2h 9m`. Year via `releaseDate.slice(0,4)` (matches search convention).

---

## 2. UI components (new, under `src/lib/components/movies/`)

One component per file (matches existing convention). Pass a single typed `movie` prop where the
field count is high (avoids 10-prop signatures).

- **`detailHeader.svelte`** — section-1 lead: large poster + title (`.display`), year, tagline,
  runtime, release date. Two-column flex at `md+`, stacked on mobile.
  - Reuse `movies/image.svelte` for the poster, BUT guard `posterPath === null` with an
    `ri-film-line` placeholder (like `search/resultPoster.svelte`) — `image.svelte` would
    otherwise build a broken `.../original/null` URL.
- **`factGrid.svelte`** — budget, revenue, genres, origin country, original language, spoken
  languages as a small definition grid. Each cell: `.label` field name + `text-ink` value.
  Uses the `format.ts` helpers. Handle empty arrays / 0 values with `'—'`.
- **`overview.svelte`** — the overview paragraph (dedicated block; `movies/description.svelte`
  couples title+date+overview so it's not a clean fit). Optionally wrap with `text/block.svelte`
  if collapsing long text is wanted.
- **`genderDistribution.svelte`** — section 2. Props: `cast` and `crew` `GenderBreakdown`s.
  For each, render a heading + a **single stacked horizontal bar** (segments for
  female/male/non-binary/unknown, widths from `$derived` percentages) + a legend with raw counts
  and `%`. **Do not reuse `progressbar.svelte`** — it renders one value over a total; a stacked
  bar reads honestly as a distribution. Use neutral existing tokens (e.g. `brand`, `accent`,
  `secondary`/`ink-muted` for unknown) — no new colors, no value-laden coloring. Handle
  `total === 0` with a "No cast/crew data" state (analogous to the budget-0 handling).

Svelte 5 runes only; static server data → `const movie = $derived(data.movie)`, no stores/`$state`.
Every `<style lang="postcss">` block starts with `@reference "...app.css"` and uses `@apply` tokens.

---

## 3. Page layout — `src/routes/movie/[movieId]/+page.svelte` (rewrite)

Replace the `<MovieTile>` + `<SimpleNav>` body with the scrolling layout. Use the page-shell
pattern from `metricsFrame.svelte` directly on a local `<main>` (`flex flex-col min-h-screen
w-full max-w-5xl m-auto p-md`) — not the `metricsFrame` component itself (it carries its own
nav/toggle semantics). Vertical rhythm via `space-y-xl` / `mt-xl`.

```
<main>
  <section id="details">          <!-- Section 1 — SSR, awaited (LCP) -->
    <DetailHeader {movie} />
    <FactGrid {movie} />
    <Overview text={movie.overview} />
  </section>

  <section id="gender">            <!-- Section 2 — same request as §1, already resolved -->
    <p class="label">Cast & crew representation</p>
    <GenderDistribution cast={movie.cast} crew={movie.crew} />
  </section>

  <section id="metrics">           <!-- placeholder: TODO(section 3) — streamed -->
    <p class="label">Diversity metrics</p>
    <SectionSkeleton variant="metrics" />
  </section>

  <section id="comments">          <!-- placeholder: TODO(section 4) — streamed -->
    <p class="label">Comments</p>
    <SectionSkeleton variant="comments" />
  </section>
</main>
```

Each `<section>` gets a stable `id` so a future in-page nav (replacing the current
`?metrics`/`?cast` `SimpleNav`) can anchor-scroll. This retires the dead Cast nav link.

**Sync vs. streamed sections.** Sections 1 & 2 come from the *same* awaited TMDB request, so they
are present in the SSR HTML — **no skeleton, no spinner** (a skeleton over already-rendered data
reads as slower, not faster). Sections 3 (metrics from Postgres) & 4 (comments) are the genuinely
async ones and are deferred to a later plan. For *this* plan they render a **static skeleton**
inside the placeholder so the page looks intentional and complete on first paint.

When sections 3/4 are implemented later, they become **streamed** via SvelteKit's deferred-promise
pattern: `+page.server.ts` returns the awaited `movie` plus *un-awaited* promises
(`{ movie, metrics: getMetrics(...), comments: getComments(...) }` — no `await`), and `+page.svelte`
wraps each in `{#await data.metrics}` showing `<SectionSkeleton>` in the pending branch. Because §1
is awaited and §3/§4 are not, the shell + details stream first and the skeletons fill in without
blocking LCP or shifting layout.

---

## Files

| File | Change |
|---|---|
| `src/routes/movie/[movieId]/datasource.server.ts` | Auth + `append_to_response=credits`, error guard, extend mapping, server-side gender aggregation |
| `src/routes/movie/[movieId]/types.ts` | **new** — `Movie`, `GenderBreakdown` interfaces |
| `src/routes/movie/[movieId]/+page.server.ts` | TODO markers for sections 3/4 (no structural change) |
| `src/routes/movie/[movieId]/+page.svelte` | **rewrite** — scrolling layout + section anchors |
| `src/lib/movie/format.ts` | **new** — currency / Intl.DisplayNames / runtime helpers |
| `src/lib/components/movies/detailHeader.svelte` | **new** — poster + title block (null-poster guard) |
| `src/lib/components/movies/factGrid.svelte` | **new** — budget/revenue/genres/country/languages |
| `src/lib/components/movies/overview.svelte` | **new** — overview paragraph |
| `src/lib/components/movies/genderDistribution.svelte` | **new** — stacked distribution bar + legend |
| `src/lib/components/feedback/skeleton.svelte` | **new** — primitive shimmer block (`width`/`height`/`rounded` props) |
| `src/lib/components/movies/sectionSkeleton.svelte` | **new** — composed placeholder for streamed §3/§4 (`variant`) |

Reused: `movies/image.svelte`, `app.css` tokens (`.label`/`.display`/`brand`/`accent`/`ink-muted`/spacing), `search/datasource.server.ts` auth pattern.

---

## Skeleton components (for the streamed sections)

Skeletons exist for the **async** sections only (3 & 4). Build two new files now so the
placeholders look finished today and the later streaming plan just drops data into `{#await}`:

- **`src/lib/components/feedback/skeleton.svelte`** — a primitive shimmer block. Props
  `width`/`height` (CSS values, default `100%`/`1rem`) and `rounded` (token, default `rounded-md`).
  Renders a single `aria-hidden` `<div>` with `bg-border` (the existing neutral surface-line token)
  and a subtle shimmer keyframe (a transl/opacity sweep, or a `surface-raised → border → surface-raised`
  gradient slide). **Gate the animation behind `prefers-reduced-motion`** — fall back to a static
  tinted block, matching how the search spinner/chevron honor reduced motion. No new color tokens.
- **`src/lib/components/movies/sectionSkeleton.svelte`** — composes the primitive into a
  section-shaped placeholder, keyed by `variant: 'metrics' | 'comments'`:
  - `metrics` → a row of 3 tile-shaped blocks (mirrors the metric tile grid that will replace it).
  - `comments` → 2–3 stacked comment rows (small avatar circle + two text lines of varying width).
  The shape should roughly match the real content's footprint so there's **no layout shift** when
  the streamed component swaps in.

UX rules:
- **Reserve the real height.** Size each skeleton to the section's expected height so the swap from
  skeleton → content (or skeleton → empty state) doesn't jump the page.
- **`aria-hidden="true"`** on skeletons; expose loading state to AT via `aria-busy` on the
  `<section>` (in the later streamed version) rather than announcing shimmer blocks.
- **Don't skeleton sections 1 & 2** — they're SSR'd and already painted.
- Add a `*.stories.svelte` for `skeleton` and `sectionSkeleton` (both variants) for visual review.

---

## Implementation tips (for Sonnet 4.6)

Codebase-specific traps that will cost you a round-trip if missed — these are the things you
can't infer from the file you're editing alone:

- **Tailwind v4 is CSS-first; `tailwind.config.js` is a lie.** It's a vestigial v3 leftover and is
  NOT read for theming. The real tokens live in `@theme`/`@theme inline` blocks in `src/app.css`.
  Use the semantic utilities (`bg-surface-raised`, `text-ink-muted`, `border-border`,
  `text-brand`, spacing `p-md`/`gap-lg`) — do not invent hex values or reach for stock Tailwind
  color names like `gray-500`.
- **Every Svelte `<style lang="postcss">` block MUST begin with `@reference "...app.css"`** (correct
  relative depth: `../../../app.css` from `src/lib/components/movies/`). Without it, `@apply` with
  the v4 tokens silently fails to resolve. Copy the exact header from a sibling like
  `movies/tile.svelte`.
- **`.svelte.ts` import extension trap (memory: svelte5-runes-module-import-extension).** Not needed
  here (no rune-class modules in this plan), but if you add one, import it with an explicit `.js`
  extension or Vite resolves the component instead of the module.
- **Do NOT import a value from a `*.server.ts` into a client component** — it'll leak/error. Types
  are erased so a `import type` is technically safe, but this plan deliberately puts `Movie`/
  `GenderBreakdown` in a non-server `types.ts` precisely so components import from there. Follow it.
- **`$env/static/private` only in `.server.ts`.** `TMDB_API_TOKEN` belongs in
  `datasource.server.ts`. The `PUBLIC_*` vars are fine anywhere.
- **Svelte 5 runes — no Svelte 4 reflexes.** `let { data }: { data: PageData } = $props()`,
  `const movie = $derived(data.movie)`, snippets via `{@render ...}`. No `export let`, no `$:`,
  no `<slot>`, no `createEventDispatcher`. This is static SSR data — you do NOT need `$state` or
  any store; reaching for one is a smell here.
- **`$derived` for the gender percentages, but the COUNTS are aggregated server-side.** Don't
  re-aggregate raw cast/crew in the component (the raw arrays aren't even shipped). The component
  only divides `female/total` etc.
- **Currency 0 means "unknown," not "$0."** `formatCurrency` returns `'—'` for 0/falsy. Same
  graceful-empty treatment for empty `genres`/`originCountry`/`spokenLanguages` arrays. Test
  Fight Club (`/movie/550`, has budget) vs. an indie (budget 0).
- **`Intl.DisplayNames` throws on junk ISO codes.** TMDB ships codes like `cn`/`xx` that aren't
  valid 639-1. Wrap in try/catch and fall back to the raw code (languages: fall back to the
  `englishName` you mapped — that's why it's in the shape). Build the `Intl.DisplayNames` instance
  once at module scope in `format.ts`, not per call/per cell.
- **`image.svelte` does not handle a null `poster_path`** — it'll build `.../original/null`. Guard
  in `detailHeader.svelte` with the `ri-film-line` placeholder pattern from
  `search/resultPoster.svelte`. Icons are Remixicon (`<i class="ri-...">`), already imported in the
  root layout.
- **Don't reuse `progressbar.svelte` for the distribution** (it's single-value/`bg-brand`). Build
  the stacked bar inline in `genderDistribution.svelte`. Keep colors neutral — this is a
  representation page; do not color-code gender in a way that reads as good/bad.
- **Match the prevailing indentation per file.** Existing files mix 2-space (search components) and
  4-space (visualization, current `+page.svelte`). Be internally consistent in each new file;
  prefer 2-space to match the search/landing components you're closest to.
- **`npm run lint` will fail wholesale (memory: midb-verify-browser-and-lint)** — repo Prettier is
  dirty across ~81 files, unrelated to your change. Don't chase it. Rely on `npm run check`
  (svelte-check) for real signal, and only format the files you touched if you format at all.
- **Verify gotcha (same memory):** Playwright's bundled browser is missing — if you run the
  integration suite, use the system Chrome channel. Prefer `npm run test:unit` + manual
  `/movie/550` for this work.

---

## Performance & smooth UX

The page is SSR'd from a single TMDB request, so the main levers are payload size, image weight,
and layout stability. Keep it fast and quiet — no jank, no flashes, no layout shift.

**Payload**
- The single-request decision already wins here: one authenticated `?append_to_response=credits`
  call instead of two round-trips. Reinforce it by **aggregating gender counts server-side** so the
  ~225 raw cast/crew entries never cross the wire — the page payload carries two tiny
  `GenderBreakdown` objects, not the full credits array (memory: midb-search-thumbnail-perf-trap is
  the same lesson — don't ship what you only need to count/thumbnail).
- Only map the fields the two sections actually use. Don't pass `production_companies`,
  `belongs_to_collection`, full `credits`, etc. into `data` "just in case" — it inflates the
  serialized SSR payload on every load.

**Images (the heaviest asset on the page)**
- The lead poster is the one place `original` is acceptable (it's the hero visual), but **set
  explicit `width`/`height`** (or a fixed aspect-ratio box, 2:3 for posters) on it and any
  placeholder so the text column doesn't reflow when the image lands — this is the biggest CLS risk
  on the page. `image.svelte` currently sets neither; give the poster a sized wrapper in
  `detailHeader.svelte`.
- Add `decoding="async"` to the poster. The poster is above the fold so **do not** lazy-load it
  (eager is correct for the LCP element); reserve `loading="lazy"` for anything below the fold.
- Consider a real `sizes` attribute on the poster `<img>` so the browser picks a `w300`/`w500`
  variant on small screens instead of always pulling `original` — `image.svelte` builds the
  `srcset` but omits `sizes`, so today every viewport downloads near-full-res. A `sizes` like
  `(max-width: 768px) 40vw, 300px` cuts mobile poster weight substantially.

**Layout stability & perceived speed**
- Because data is SSR'd, the page arrives fully populated — no client-side loading spinner needed
  for sections 1 & 2. Avoid introducing one; a spinner on already-present data reads as slower.
- Reserve space for the gender bars (fixed bar height) so the legend below them doesn't jump as
  styles apply.
- The stacked-bar segment widths can **animate from 0 → their percentage on mount** for a touch of
  polish (CSS `width` transition like `progressbar.svelte`'s `transition: width 0.5s ease-in-out`).
  **Gate it behind `prefers-reduced-motion`** — the search components already honor this; match
  that. No animation on the numbers/legend.

**Rendering**
- `$derived` for percentages is effectively free; don't memoize further.
- Build the `Intl.NumberFormat`/`Intl.DisplayNames` instances **once at module scope** in
  `format.ts` (not per cell/render) — constructing them is the expensive part of `Intl`.
- Keep section 3/4 placeholders as empty anchored `<section>`s — no data fetching, no components,
  zero cost until their later plan lands.

---

## Verification

- `npm run check` (svelte-check) — type-checks the new `Movie` mapping and component props.
- `npm run test:unit` (Vitest) — add `format.spec.ts` (currency 0 → "—", runtime, DisplayNames
  fallback) and a gender-reduce fixture test (mixed genders, missing `credits`, empty cast).
- Storybook (`*.stories.svelte` precedent) — stories for `genderDistribution` and `factGrid`
  with fixtures incl. budget-0 and empty-credits edge cases, for visual review without TMDB.
- Manual: load `/movie/550` (Fight Club — has budget/revenue/credits) and an indie with
  budget 0 to confirm "—" handling and the null-poster placeholder.

---

## Implementation status (shipped 2026-06-03)

Sections 1 & 2 are **implemented and merged**. `npm run check` is clean (0 errors) and
`npm run test:unit` passes (23 tests). Notable deviations from the plan as written:

- **`overview.svelte` was built then removed.** Per a follow-up request, the movie **summary
  (`overview`) now lives inside `detailHeader.svelte`** (replacing the tagline) as a `.summary`
  paragraph, so the standalone `Overview` block and its component were dropped to avoid showing
  the same text twice. `movie.tagline` is still mapped in the datasource/`Movie` type but is **no
  longer rendered**.
- **`image.svelte` gained an `imgSizes` prop** (the prop is named `imgSizes`, not `sizes`, to avoid
  colliding with the module-scope `sizes` array) plus `decoding="async"`, and its `src` default was
  changed from `original` → `w500` so the fallback candidate is bounded (the original was the LCP
  perf trap — the `srcset`+`sizes` now drive variant selection).
- **`skeleton.svelte` gained a `static` prop.** Because sections 3/4 don't stream yet, the
  `sectionSkeleton` placeholders pass `static` to render a non-animating tint rather than running
  six infinite shimmer animations forever for content that won't load until a later plan. The
  shimmer path remains for the eventual streamed use.
- **No `*.stories.svelte` were added** for `skeleton`/`sectionSkeleton`/`genderDistribution`/
  `factGrid` (the plan suggested them). Coverage is via `format.spec.ts` + `datasource.spec.ts`
  (the `aggregateGender` helper is exported for testing) instead. Stories remain a TODO if visual
  review is wanted.
- **Navbar + footer were lifted into the root layout** (see the separate layout work below).

### Files actually shipped
| File | State |
|---|---|
| `src/routes/movie/[movieId]/types.ts` | new — `Movie`, `GenderBreakdown` |
| `src/routes/movie/[movieId]/datasource.server.ts` | rewritten — auth + `credits`, error guard, exported `aggregateGender` |
| `src/routes/movie/[movieId]/datasource.spec.ts` | new — `aggregateGender` fixture tests |
| `src/routes/movie/[movieId]/+page.server.ts` | TODO(sections 3/4) markers |
| `src/routes/movie/[movieId]/+page.svelte` | rewritten — `#details`/`#gender`/`#metrics`/`#comments` sections |
| `src/lib/movie/format.ts` (+ `format.spec.ts`) | new — currency/Intl/runtime helpers |
| `src/lib/components/movies/detailHeader.svelte` | new — poster + title + **summary** (was tagline) |
| `src/lib/components/movies/factGrid.svelte` | new |
| `src/lib/components/movies/genderDistribution.svelte` | new — stacked bar, static (no width animation) |
| `src/lib/components/feedback/skeleton.svelte` | new — shimmer primitive w/ `static` prop |
| `src/lib/components/movies/sectionSkeleton.svelte` | new — `metrics`/`comments` variants |
| `src/lib/components/movies/image.svelte` | edited — `imgSizes`, `decoding`, bounded `src` |
| ~~`src/lib/components/movies/overview.svelte`~~ | built then **removed** (summary moved into header) |

### Layout chrome (follow-up, same session)
A nav bar and footer were added to the **root layout** so every route gets them:
- `src/lib/components/layout/navbar.svelte` — wordmark + `ThemeToggle` + Sign in (extracted from
  `landing/topBar.svelte`; bottom border).
- `src/lib/components/layout/footer.svelte` — brand wordmark + Home/Sign in links.
- `src/routes/+layout.svelte` — now a `flex flex-col min-h-screen` shell: `<Navbar>` header,
  `<main class="flex-1 max-w-5xl mx-auto">` content, `<Footer>`.
- `src/routes/+page.svelte` (landing) — dropped its own `TopBar` + inline footer + `max-w-5xl`
  wrapper (now provided by the layout).
- `src/routes/movie/[movieId]/+page.svelte` — swapped its `<main>` for a `<div>` (avoids nesting
  inside the layout `<main>`) and dropped redundant centering/min-height.
