# Landing Page Movie Search

## Context

The landing page (`src/routes/+page.svelte`) has a hero search box, but it currently
just navigates to a non-existent `/search` page on submit. The goal is a **live,
debounced search**: as the user types, the title is sent to TMDB's `/search/movie`
endpoint and results render directly under the input. Each result shows a small
poster plus condensed info (title + release year), and clicking a result navigates
to that movie's overview page (`/movie/[movieId]`).

Most of the scaffolding already exists but is unwired:
- `src/lib/stores/debounced.ts` — `createDebouncedSearchStore` (RxJS: `debounceTime`,
  `distinctUntilChanged`, `switchMap`). Ready to reuse, currently unused.
- `src/lib/components/search/searchForm.svelte` — input + button, emits `onaction(query)`
  on both input and submit.
- `src/lib/components/landing/heroSearch.svelte` — wraps SearchForm, currently does
  `goto('/search?q=...')` on submit only.
- `src/lib/components/search/movieSearch.svelte` — **empty file**, the intended home
  for the live-search feature.
- `src/lib/components/movies/image.svelte` — builds TMDB poster URLs/srcset from a
  `poster_path`. Reuse for thumbnails.

**Decisions (confirmed with user):**
- Inline live results only — remove the submit-and-navigate behavior; no `/search` page.
- Browser reaches TMDB via a **SvelteKit server API route** that proxies the request
  using the server-only `TMDB_API_TOKEN` (v4 Bearer). This keeps the token off the
  client and matches the existing `*.server.ts` convention.
- Each result row: **poster thumbnail + title + release year**.

Note: `TMDB_API_TOKEN` is declared in `.env` but not yet used anywhere — `getMovie`
in `datasource.server.ts` currently calls TMDB unauthenticated. The search endpoint
requires auth, so this is the first authenticated TMDB call.

## Implementation

### 1. Server proxy endpoint — `src/routes/api/search/+server.ts` (new)

A `GET` handler that:
- Reads `q` from `url.searchParams`. If empty/whitespace, return `{ results: [] }`
  (200) without calling TMDB.
- Imports `TMDB_API_TOKEN` from `$env/static/private` and `PUBLIC_TMDB_API_URL` from
  `$env/static/public`.
- Calls `GET {PUBLIC_TMDB_API_URL}/3/search/movie?query=<q>&include_adult=false&language=en-US&page=1`
  with header `Authorization: Bearer ${TMDB_API_TOKEN}`.
- Maps the TMDB response to a slim shape the client needs, returning **only** what the
  row renders (avoids shipping full overviews):
  ```ts
  type SearchResult = {
    id: number;
    title: string;
    posterPath: string | null;   // poster_path
    releaseYear: string;         // release_date.slice(0,4), '' if missing
  };
  ```
- Returns via `json({ results })` from `@sveltejs/kit`.
- On a non-ok TMDB response, return `{ results: [] }` with a logged warning (keep the
  UI resilient; don't surface a 500 for a transient search failure).

Extract the mapping into a small `datasource.server.ts` alongside the route (mirrors
`src/routes/movie/[movieId]/datasource.server.ts`) — keeps the handler thin and the
TMDB-shape knowledge in one place. Reuse the existing `Movie` snake_case→camelCase
mapping style.

### 2. Live search component — `src/lib/components/search/movieSearch.svelte` (fill in)

- Define a `source` function: `async (query) => fetch('/api/search?q=' + encodeURIComponent(query)).then(r => r.json()).then(d => d.results)`.
- Create the store: `const store = createDebouncedSearchStore(source)` (default 500ms
  debounce; `distinctUntilChanged` + `switchMap` already cancel stale queries).
- Subscribe with a Svelte 5 rune-friendly pattern: hold `let results = $state([])` and
  in `$effect`, `store.subscribe(r => results = r)` returning the unsubscribe for
  cleanup. (Avoid `$` auto-subscription since the store is a custom object, not a
  Svelte store contract.)
- Render `<SearchForm action="/api/search" method="get" onaction={store.search} />`,
  then a results dropdown below it.
- Each result row is an `<a href={'/movie/' + id}>` containing:
  - the poster via `movies/image.svelte` (`src={posterPath}`), sized small;
    fall back to a placeholder block when `posterPath` is null.
  - `title` and `releaseYear`.
- Empty/whitespace query → render nothing. Non-empty query with zero results →
  small "No matches" line.
- **Keyboard navigation** (see step 2b below).
- **Click-outside-to-close:** clicking anywhere outside the component closes the
  dropdown (`results = []`, `activeIndex = -1`). Implement with a `svelte:window`
  `onpointerdown` (or `onclick`) handler that checks the event target is not contained
  within the component's root element (hold a `bind:this` ref to the root). Don't close
  on clicks inside the input or on a result row. Re-typing reopens results normally.
- Style the dropdown as an absolutely-positioned panel under the input
  (`bg-surface-raised`, `border-border`, `rounded-md`, `shadow-md`), matching the
  tokens already used in `searchForm.svelte` and `movies/tile.svelte`.

### 2b. Keyboard navigation (in movieSearch.svelte)

Make the dropdown fully keyboard-operable while focus stays in the input:
- Track `let activeIndex = $state(-1)` (–1 = nothing highlighted; raw text query).
- Reset `activeIndex = -1` whenever a new `results` array arrives.
- On the input's `onkeydown`:
  - **ArrowDown** → `activeIndex = (activeIndex + 1) % results.length`; `preventDefault`
    (stop the caret from jumping to end of line).
  - **ArrowUp** → `activeIndex = (activeIndex - 1 + results.length) % results.length`;
    `preventDefault`. Wraps around both ends.
  - **Enter** → if `activeIndex >= 0`, `preventDefault` and
    `goto('/movie/' + results[activeIndex].id)`. (With no active row, do nothing —
    there is no submit destination since search is inline-only.)
  - **Escape** → clear results / close the dropdown (`results = []`, `activeIndex = -1`).
- Render rows with `class:active={i === activeIndex}` and
  `aria-selected={i === activeIndex}`; the active row gets a highlighted background
  (`bg-surface-sunken`/`bg-brand-subtle` per available tokens). Also set `activeIndex`
  on `onmouseenter` so mouse and keyboard share one highlight model.
- Accessibility: put `role="listbox"` on the panel and `role="option"` on each row;
  set `aria-activedescendant` on the input to the active row's id, and give each row a
  stable `id={'result-' + movie.id}`. Add `aria-autocomplete="list"` to the input.
  (The input lives in `searchForm.svelte`; pass these through, or move the input markup
  into `movieSearch.svelte` if threading the attrs/handlers through SearchForm's props
  proves awkward — SearchForm only exposes `onaction` today, so a small prop addition
  or local input is expected here.)
- Scroll the active row into view (`scrollIntoView({ block: 'nearest' })`) via an
  `$effect` keyed on `activeIndex` so long result lists stay usable.

### 3. Wire it into the landing page

Replace `HeroSearch` usage with the new live `MovieSearch`. Two options, pick the
smaller diff:
- **Preferred:** change `src/lib/components/landing/heroSearch.svelte` to render
  `MovieSearch` instead of the bare `SearchForm` + `goto`. The landing page keeps
  importing `HeroSearch`, so `+page.svelte` is untouched and the `.search-wrap`
  styling still applies.
- Drop the now-unused `goto`/`submitted` logic from `heroSearch.svelte`.

The `.search-wrap` in `+page.svelte` has `max-width: 32rem` and the dropdown is
positioned relative to it, so add `position: relative` on the wrapping element in
`heroSearch.svelte` (or MovieSearch's root) so the absolute panel anchors correctly.

## Files

- `src/routes/api/search/+server.ts` — new GET proxy endpoint.
- `src/routes/api/search/datasource.server.ts` — new; TMDB call + mapping.
- `src/lib/components/search/movieSearch.svelte` — fill in (currently empty).
- `src/lib/components/landing/heroSearch.svelte` — render MovieSearch; remove goto.

Reused as-is: `src/lib/stores/debounced.ts`, `src/lib/components/search/searchForm.svelte`,
`src/lib/components/movies/image.svelte`.

## Verification

1. Ensure `.env` has a valid `TMDB_API_TOKEN`, `PUBLIC_TMDB_API_URL`, `PUBLIC_TMDB_IMAGE_URL`.
2. `bun run dev`, open the landing page.
3. Type "fight club" → within ~500ms a dropdown of posters + titles + years appears
   under the input. Confirm rapid typing only fires after you stop (debounce) and that
   older in-flight queries don't overwrite newer results (`switchMap`).
4. Click a result → lands on `/movie/<id>` overview.
5. **Keyboard:** with results open, ArrowDown/ArrowUp move the highlight (wrapping at
   both ends), the active row scrolls into view, Enter on a highlighted row navigates
   to `/movie/<id>`, Escape closes the dropdown. Moving the mouse over a row updates
   the same highlight. Verify with a screen reader / a11y devtools that the input
   announces the active option (`aria-activedescendant` + `role="option"`).
6. Clear the input → dropdown disappears; gibberish query → "No matches".
   With results open, click anywhere outside the search box → dropdown closes;
   clicking inside the input or on a result behaves normally (no premature close).
7. Network tab: requests go to `/api/search?q=...` (not directly to TMDB); the Bearer
   token never appears in client traffic.
8. Type-check: `bun run check`. Lint: `bun run lint`.

### Optional follow-ups (not in scope unless requested)
- A `movieSearch` Storybook story (a `searchForm.stories.svelte` already exists).

---

## Implementation Guide (for the implementing model — Sonnet 4.6)

You are implementing the plan above. Read it fully first, then follow this guidance.
This repo is **Svelte 5 + SvelteKit 2 + Tailwind v4**, run with **Bun**. Match
existing conventions exactly — do not introduce new patterns or libraries.

### Order of work (build inside-out, verify as you go)
1. `src/routes/api/search/datasource.server.ts` — TMDB call + mapping.
2. `src/routes/api/search/+server.ts` — the GET handler that uses it.
3. Smoke-test the endpoint alone: `bun run dev`, then
   `curl 'http://localhost:5173/api/search?q=fight+club'` — expect JSON
   `{ results: [...] }` with `posterPath`/`releaseYear`. Fix this before touching UI.
4. `src/lib/components/search/movieSearch.svelte` — live results + keyboard nav.
5. `src/lib/components/landing/heroSearch.svelte` — swap in MovieSearch, delete goto.
6. Run `bun run check` and `bun run lint`, then do the manual Verification steps.

### Read these before writing code (ground yourself in the conventions)
- `src/routes/movie/[movieId]/datasource.server.ts` — the exact snake_case→camelCase
  mapping style and `$env/static/public` import to mirror.
- `src/lib/stores/debounced.ts` — the store you consume; note it returns a plain
  object `{ search, subscribe }`, **not** a Svelte store, and `subscribe` is RxJS's
  (returns a `Subscription` with `.unsubscribe()`, not Svelte's unsubscribe fn).
- `src/lib/components/search/searchForm.svelte` — emits `onaction(query)` on both
  `oninput` and submit. Wire `onaction={store.search}`.
- `src/lib/components/movies/image.svelte` — pass `src={posterPath}`; it builds the URL.
- `src/lib/components/movies/tile.svelte` — copy its Tailwind token vocabulary
  (`bg-surface-raised`, `border-border`, `rounded-md`, `shadow-md`, `p-sm`, etc.).

### Svelte 5 specifics (do not regress to Svelte 4)
- Props: `let { ... }: Props = $props();` with an `interface Props`. No `export let`.
- State: `let results = $state<SearchResult[]>([])`, `let activeIndex = $state(-1)`.
- Side effects / subscription: use `$effect`. Because the store is RxJS-backed, do:
  ```ts
  $effect(() => {
    const sub = store.subscribe((r) => { results = r; activeIndex = -1; });
    return () => sub.unsubscribe();   // RxJS Subscription
  });
  ```
  Do **not** use `$store` auto-subscription syntax — it won't satisfy the Svelte store
  contract and will break.
- Events are attributes: `onkeydown`, `oninput`, `onmouseenter` (lowercase, no `on:`).
- Component style blocks use `<style lang="postcss">` with
  `@reference "../../../app.css";` at the top (count the `../` to reach `src/app.css`
  from the file's location — for `search/` it is `../../../app.css`). Use `@apply`.

### Server route (`+server.ts`) details
- Export `const GET: RequestHandler`. Import `RequestHandler` from `./$types`.
- `import { json } from '@sveltejs/kit'`.
- `import { TMDB_API_TOKEN } from '$env/static/private'` — note **private**, not public.
  This is the first use of that var in the repo; it is already in `.env`.
- Short-circuit empty query before the fetch. Wrap the TMDB fetch in try/catch; on
  failure log with `console.warn` and return `json({ results: [] })`. Never 500 the UI.
- TMDB needs the token as `Authorization: Bearer ${TMDB_API_TOKEN}` and
  `accept: application/json`. Build the URL from `PUBLIC_TMDB_API_URL` + `/3/search/movie`
  with `query`, `include_adult=false`, `language=en-US`, `page=1`.

### Keyboard nav details
- Implement the keydown handler in `movieSearch.svelte`. SearchForm currently only
  exposes `onaction`, so threading `onkeydown`/ARIA attrs through it is awkward — the
  cleanest path is to **render the input locally in movieSearch** (copying SearchForm's
  input markup + the brand-button styling) rather than extending SearchForm's API.
  Prefer the smaller, self-contained component over a prop explosion.
- Follow step 2b exactly for Arrow/Enter/Escape behavior, wrap-around math, mouse-hover
  sharing `activeIndex`, `scrollIntoView({ block: 'nearest' })` in an `$effect` keyed on
  `activeIndex`, and the `role="listbox"`/`role="option"`/`aria-activedescendant` wiring.
- Use `goto` from `$app/navigation` for Enter-to-select (same import heroSearch uses
  today).
- **Click-outside-to-close:** add `bind:this={root}` to the component's root element
  and a `<svelte:window onpointerdown={onWindowPointerDown} />`; in the handler, close
  when `root && !root.contains(event.target as Node)`. Use `pointerdown` (not `click`)
  so it fires before a result's navigation, but guard against closing on in-component
  clicks via the `contains` check.

### Guardrails
- Keep `posterPath` nullable; render a neutral placeholder block when it's null
  (don't pass null into the Image component blindly — check first).
- Don't add new dependencies; RxJS, Tailwind, and SvelteKit are already present.
- Don't create a `/search` page — search is inline-only.
- Touch only the four files in the **Files** list. Leave `getMovie`/other TMDB callers
  alone.
- After coding, run `bun run check` and `bun run lint` and fix anything they report
  before declaring done.
