# Landing: random hero films, direct title links, short project explainer

## Context

The landing hero (`src/lib/components/landing/filmSentences.svelte`) rotates through the same 6
films on every visit: `getMostVotedRatedFilms(6, { requireUmEntry: true })` in
`src/routes/+page.server.ts` returns the top 6 by IMDb votes (the only "ranking" in the DB:
`title_bechdel.num_votes`). Films without a `tmdb_id` render as a `<button>` that pushes the title
into the search field instead of opening the film. The user wants: a random set per page load
drawn from that ranking, every hero title navigating straight to `/movie/[id]`, and a short,
factual explanation of the project between the search bar and the Sources section.

Caching constraint: `/` sets `PUBLIC_PAGE` (`s-maxage=3600`), so the CDN would serve one random
set to everyone for an hour. Randomising per load needs the landing response to stop being shared
-cached (it's user-agnostic, so `public, max-age=0, s-maxage=0` / a new constant is safe). The
alternative (client-side shuffle of a cached pool) causes a hydration swap of the visible
sentence, which CLAUDE.md forbids above the fold.

## Changes

1. **`src/lib/server/data/catalogue.ts`** – add `getRandomRatedFilms(limit, { pool, requireUmEntry })`:
   pick from the `pool` (default 100) most-voted Bechdel-rated films that have a UM entry **and a
   non-null `tmdb_id`**, ordered `random()` in SQL, `limit` 6. Implement as a subquery/CTE of the
   top `pool` by `numVotes`, then `ORDER BY random() LIMIT n`. Reuse the existing row → `RatedFilm`
   mapping (extract it into a local `toRatedFilm` helper shared with `getMostVotedRatedFilms`).
   Implemented as: `getMostVotedRatedFilms` gains a `requireTmdbId` option; `getRandomRatedFilms(count, pool)` samples its result in JS (partial Fisher–Yates).
2. **`src/lib/media/types/catalogue.ts`** – add `LinkedRatedFilm` (`RatedFilm` with `tmdbId: number`) for this query.
3. **`src/lib/server/http/cache.ts`** (user chose: stop CDN caching for `/`) – add
   `PUBLIC_UNCACHED = 'no-store'`, documented as "user-agnostic but varies per request (landing's random films)".
   `src/routes/+page.server.ts` uses it and calls `getRandomRatedFilms(6)`.
4. **`filmSentences.svelte`** – remove the `onsearch` prop and the `<button>` branch; every title is
   the `<a href={resolve('/movie/[movieId]', …)}>`. Caption becomes code-backed:
   "Six films picked at random from the 100 with the most IMDb votes." (third person, no em dash).
   Keep key `film.tmdbId`.
5. **`src/routes/+page.svelte`** – drop `searchFor`/`hero` binding and the `onsearch` prop. Add,
   after the hero `<section>` and before Sources, a centred paragraph in the existing `.statement`
   voice (reuse the `.about` centred layout styles; max-width ~40rem; same section spacing):

   > MIDB puts four public sources on one page for each film or series: sexual violence flags,
   > trigger warnings, the Bechdel Test and the gender of cast and crew. The verdicts are computed
   > from those records alone. MIDB does not rate titles itself.

   With a `.chip` "Methodology" → `/resources`. Plain, third person, no "what we / what it is",
   no em dashes; claims match `verdict.ts` (verdicts derive only from source data).

6. **Tests**
   - `src/lib/server/data/__tests__/catalogue.db.spec.ts`: replace the most-voted test with
     `getRandomRatedFilms` cases: excludes films without `tmdb_id` or UM entry; only draws from
     the top-`pool` by votes (pool=2 with 3 films never returns the lowest); returns ≤ limit.
   - `e2e-tests/landing.spec.ts`: hero title is a link to `/movie/` when films exist (skip if
     the DB is empty), explainer text visible.
7. **Docs** – update `.CLAUDE/architecture.md` (catalogue query, new cache constant, landing
   explainer); save this plan as `.CLAUDE/plans/plan-landing-random-films.md`.

## Verification

`docker compose up -d db`, then `bun run check`, `bun run lint`, `bun run test:unit`,
`bun run test:db`, `bun run build`. Run the dev server, reload `/` a few times to see a different
set, click a hero title → lands on `/movie/<id>`; confirm the `cache-control` header on `/`.
Commit and push to `ccr-054fe596-sm87za`.
