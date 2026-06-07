# Plan — Navbar search bar (all pages except landing)

## Context

MIDB's only search entry point today is the **landing hero search** (`/`). Once a
user navigates into a detail page (`/movie/[movieId]`, `/tv/[seriesId]`) or the
auth/dashboard pages, there is no way to start a new search without going back to
`/`. This adds a **persistent search bar in the global navbar**, available on every
page **except the landing page** (which already has its prominent hero search).

The live-search component (`$lib/components/search/movieSearch.svelte`) is already
fully self-contained: it owns its own `MovieSearchState` instance (debounced 500ms
TMDB query, keyboard nav, click-outside dismiss, `mediaType`-aware routing) and its
own dropdown panel. So the work is **composition + visibility gating + navbar
layout/styling**, not new search logic.

Performance is preserved for free: the search panel already debounces (500ms),
clears stale rows, and renders fixed `w92` thumbnails (`resultPoster.svelte`); the
navbar instance only mounts on non-landing pages, so the landing page keeps a single
search instance and pays no extra cost.

## Approach

### 1. Detect the current route in the navbar

In `src/lib/components/layout/navbar.svelte`, read the current path from
`$app/stores`:

```ts
import { page } from '$app/stores';
const showSearch = $derived($page.url.pathname !== '/');
```

(Use `$app/stores` `page` — already the SvelteKit-idiomatic reactive source; no new
dependency. `$derived` over `$page.url.pathname` recomputes only on navigation, no
effects, per the perf rules in CLAUDE.md.)

### 2. Render `MovieSearch` in the navbar, gated on `showSearch`

Compose the existing component — **do not duplicate search logic**:

```svelte
import MovieSearch from '$lib/components/search/movieSearch.svelte';
...
{#if showSearch}
  <div class="nav-search">
    <MovieSearch />
  </div>
{/if}
```

Place it between the wordmark and the actions so the navbar reads
`MIDB … [search] … theme / sign-in`.

### 3. Navbar layout — make room for the search box

The current navbar is a simple `flex justify-between`. Add a constrained,
flex-growing slot for the search so it sits centered-ish and never overlaps the
wordmark or actions:

- Wordmark: `shrink-0`.
- `.nav-search`: `flex-1` with a `max-width` cap (~`24rem`) and horizontal margin
  (`mx-md`) so it doesn't stretch edge-to-edge on wide screens.
- Actions: `shrink-0`.
- The navbar dropdown panel must overlay page content: `MovieSearch`'s `.root` is
  already `relative w-full`, and `SearchResults` renders an absolutely-positioned
  panel, so no extra stacking work is needed beyond ensuring the navbar/header isn't
  `overflow-hidden` (it isn't).

### 4. Sizing/visual language vs. the hero search

The hero search (`landing/heroSearch.svelte`) deliberately up-sizes the box
(`text-lg`, brand glow, larger submit). The **navbar search should stay compact** —
just the bare `MovieSearch` (default `searchInput` sizing: `text` default, small
padding), matching navbar density. Do **not** reuse `heroSearch.svelte` (it carries
landing-only sizing/glow). Reuse only the underlying `MovieSearch`.

If the submit button is too heavy for the navbar, an optional refinement is to hide
the button label on small widths (already done via `.btn-label` media query in
`searchInput.svelte`) — no change needed; the existing responsive behavior applies.

### 5. Responsive behavior

- On narrow screens the navbar already hides the "Sign in" link (`max-width:479px`).
  The search box keeps `flex-1` so it takes the freed space.
- Keep the search visible on mobile (it's the primary nav action on inner pages);
  rely on `flex-1` + `min-w-0` (already on the input) to prevent overflow.

## Critical files

- `src/lib/components/layout/navbar.svelte` — **main change**: import `page` +
  `MovieSearch`, add `showSearch` derived, render gated search slot, update nav
  layout CSS.
- `src/lib/components/search/movieSearch.svelte` — **reused as-is** (no change
  expected).
- (Reference only) `src/lib/components/landing/heroSearch.svelte` — the existing
  consumer pattern; the navbar is a second, unstyled consumer.

## Architecture doc update

Per CLAUDE.md "Always" rule, update `.CLAUDE/architecture.md`:
- In the **Component library** table / `layout/` row: note `navbar` now embeds
  `search/movieSearch`, shown on all routes except `/`.
- In the **Live search** section: note there are now two `MovieSearch` mount points
  (landing hero + global navbar), each with its own independent `MovieSearchState`.

## Verification

1. `bun run check` → 0 errors.
2. `bun run test:unit` → all pass (no test touches navbar; confirm none regress).
3. `bun run build` → clean.
4. Manual / `bun run dev`:
   - Landing `/`: navbar shows **no** search box (hero search only).
   - `/movie/[id]`, `/tv/[id]`, `/auth`, `/user/dashboard`: navbar **shows** the
     search box.
   - Type a query in the navbar box → dropdown appears, debounced; arrow keys +
     Enter navigate; selecting a result routes to the correct
     `/movie` or `/tv` page; click-outside dismisses.
   - Navbar search panel overlays page content (no clipping), zero layout shift on
     open.
   - Narrow viewport: box stays usable, no overflow.
