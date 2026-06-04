# Plan: TV-series support (movies + TV)

> Adds TV series alongside movies. New `/tv/[seriesId]` route mirroring `/movie/[movieId]`,
> `search/multi` for mixed search, and a season/episode selector on the DDD section.
> Bechdel is N/A for series; UM works as today (one entry per series). Written for
> implementation by Sonnet 4.6 — see **Implementation tips** call-outs throughout.
> Read `.CLAUDE/architecture.md` first; this plan assumes its conventions.

## Context

MIDB only handles movies today: TMDB `search/movie` + `movie/{id}`, a `/movie/[movieId]`
detail page, three sources (Bechdel seeded movie-only; UM one entry per title; DDD live).
We want TV series too. Decisions already made:

- **Routing:** new `/tv/[seriesId]` mirroring `/movie/[movieId]`.
- **DDD:** season + episode selector, defaulting to the whole-series view.
- **Bechdel/UM:** keep all three sections on TV pages — Bechdel renders "Not applicable to
  series"; UM works unchanged.

TMDB: `search/multi` (mixed), `tv/{id}` for details, `tv/{id}/credits` (appended) for the
gender breakdown.

### Verified API facts (live checks during planning — do not re-derive)

- **DDD `imdb=` lookup fails for TV.** Series are stored with `imdbId: null`;
  `dddsearch?imdb=tt0903747` (Breaking Bad) → 0 items. There is **no** `tmdbid`/`tmdb`
  query param on `dddsearch` (they return non-JSON).
- **DDD text search works and exposes `tmdbid`.** `dddsearch?q=Game of Thrones` returns
  items carrying `id`, `name`, `releaseYear`, **`tmdbid`** (lowercase), and `itemType`
  (`id:16`=TV Show, `15`=Movie, `14`=Book). **TV lookup =** text-search by name → keep
  `itemType.id === 16` → match `tmdbid === Number(series.tmdbId)` (GoT → DDD `678166`);
  fall back to `releaseYear` == first-air year; else empty.
- **DDD season/episode filtering is client-side.** `media/{id}` returns the full
  `topicItemStats` array regardless of `?index1=&index2=` (server just echoes them). Each
  stat carries integer `index1` (season) / `index2` (episode): `-1` = series-level,
  `null` = unscoped, positive = that episode. `item.itemType.index1==='season'` discriminates
  a series response. **One fetch, filter in the component.**
- **DB unique clash.** `movies` has `imdb_id` unique-NOT-NULL and `tmdb_id` unique-nullable.
  TMDB movie/tv ids share the integer space → a movie and series with the same `tmdbId`
  would violate the unique `tmdb_id`. Avoided without migration (Step 2 DB note).

---

## Guiding principles (the four axes this plan optimizes for)

- **DB performance:** TV adds **zero new queries per page** beyond what movies already do,
  and **one fewer** (no Bechdel). No new tables, no migration. The only DB touch for a TV
  page is the existing UM path (`getOrCreateDbMovie` + `getUnconsenting` + maybe
  `getUnconsentingCandidates`), all already indexed (`tmdb_id`/`imdb_id` unique, `um_source`
  by `clean_title_key`). Keep `getBechdel` **out** of the TV load — don't issue a query whose
  answer is always "N/A".
- **Client performance:** the heavy external call (DDD) stays **streamed/un-awaited** exactly
  as movies do — TMDB details block SSR, DDD never does. The season/episode selector filters
  an **already-fetched** array with a single `$derived` — no refetch on selection. Reuse the
  `w92` thumbnail path untouched (the documented perf trap). One DDD fetch per page, 1h cached.
- **Maintainability:** **extract before forking.** Today `detailHeader.svelte` and
  `factGrid.svelte` import `Movie` straight from the movie route's `types.ts` — a coupling
  that would force the TV route to either duplicate components or import movie types. Fix it
  with a shared `MediaDetail` supertype so one set of header/gender components serves both,
  and generalize the DDD module in place rather than copying it.
- **Good practices:** mirror existing house patterns (streamed DDD, `$derived` over `$effect`,
  scoped `<style lang="postcss">` with `@reference`, `resolve(...)` for typed links, server-only
  `*.server.ts`). No new deps. Match the existing tab indentation in each file you touch.

---

## Step 0 — Shared extraction (do this first; it's what keeps the diff small)

**`src/lib/movie/media.ts`** (new, client-safe pure types):

```ts
export interface GenderBreakdown {
  unknown: number; female: number; male: number; nonBinary: number; total: number;
}

/** Fields common to movies and series — what the shared header/gender components need. */
export interface MediaDetail {
  id: string;
  title: string;
  imdbId: string | null;
  posterPath: string | null;
  overview: string;
  tmdbId: string;
  /** Movie release date OR series first-air date — already a YYYY-... string or ''. */
  releaseDate: string;
  genres: { id: number; name: string }[];
  originCountry: string[];
  originalLanguage: string;
  spokenLanguages: { iso: string; englishName: string }[];
  cast: GenderBreakdown;
  crew: GenderBreakdown;
}
```

- `movie/[movieId]/types.ts`: `export interface Movie extends MediaDetail { tagline; runtime;
  budget; revenue; }`. Re-export `GenderBreakdown` from `media.ts` so existing imports keep working.
- `Series` (Step 2) also `extends MediaDetail`.

> **Sonnet 4.6 tip:** `GenderBreakdown` currently lives in `movie/[movieId]/types.ts` and is
> re-exported from `datasource.server.ts`. Move the *definition* to `media.ts` and turn the old
> spot into a re-export (`export type { GenderBreakdown } from '$lib/movie/media';`). Then run
> `bun run check` — TS will point you at every consumer; don't hand-hunt them.

**`src/lib/server/tmdb.ts`** (new, server-only):

```ts
import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';

export const TMDB_BASE = PUBLIC_TMDB_API_URL;
export function tmdbHeaders() {
  return { Authorization: `Bearer ${TMDB_API_TOKEN}`, accept: 'application/json' };
}

export interface TmdbCreditEntry { gender: number; }
export function aggregateGender(entries: TmdbCreditEntry[]): GenderBreakdown { /* moved verbatim */ }
```

- Move `aggregateGender` out of `movie/[movieId]/datasource.server.ts` to here; re-export it
  from the old location so `getMovie` and its spec keep importing the same name.

> **Sonnet 4.6 tip:** Keep this in `src/lib/server/` (not `$lib/movie/`) — anything reading
> `$env/static/private` must never be importable by client code. SvelteKit enforces `.server.ts`
> / `$lib/server/`; a plain `$lib/movie/tmdb.ts` touching the private token would fail the build.

---

## Step 1 — Search via `search/multi`

- **`src/lib/components/search/types.ts`** — add `mediaType: 'movie' | 'tv'` to `SearchResult`.
- **`src/routes/api/search/datasource.server.ts`** — rename `searchMovies` → `search`; hit
  `/3/search/multi`; use `tmdbHeaders()`. Drop `media_type === 'person'`. Map
  `title: item.title ?? item.name ?? ''`, `releaseYear` from `release_date` ?? `first_air_date`,
  `mediaType: item.media_type`.
- **`src/routes/api/search/+server.ts`** — import `search` (keep the empty-`q` short-circuit).
- **`src/lib/components/search/movieSearch.svelte.ts`** — `select(item)` routes by `mediaType`:
  `resolve('/tv/[seriesId]', { seriesId: String(item.id) })` vs the movie route. Make
  `optionId(id, mediaType)` include the type — **movie and tv ids collide numerically**, so the
  DOM `id` and `aria-activedescendant` must stay unique (e.g. `search-option-${mediaType}-${id}`).
- **`src/lib/components/search/searchResult.svelte`** — derive `href` by `mediaType` (same branch
  as `select`); show a movie/tv glyph (`ri-film-line` vs `ri-tv-2-line`) + small "TV"/"Film" badge;
  pass `mediaType` to `optionId`.
- **`src/lib/components/search/searchResults.svelte`** — `aria-label="Movie results"` →
  `"Search results"`; update the `optionId(...)` used for scroll-into-view.
- **`src/lib/components/search/searchInput.svelte`** — placeholder `"Search movies..."` →
  `"Search movies & TV…"`.
- `resultPoster.svelte` — **unchanged** (poster-path agnostic; keep the `w92` perf path).

> **Sonnet 4.6 tip:** `optionId` is called in `movieSearch.svelte.ts` (`activeId` getter) and the
> two result components. Change the signature to `(id, mediaType)` and let `bun run check` flag the
> three call sites — don't grep-and-replace blind, the getter passes a derived value.
> **Client-perf note:** the debounced RxJS store and 500ms debounce are unchanged — `search/multi`
> is one request like `search/movie` was, so no extra round-trips.

---

## Step 2 — New `/tv/[seriesId]/` route (mirror of `movie/[movieId]/`)

**`src/routes/tv/[seriesId]/types.ts`**

```ts
import type { MediaDetail } from '$lib/movie/media';
export type { UmCandidate } from '$lib/movie/metrics.js';
export interface Series extends MediaDetail {
  firstAirDate: string; lastAirDate: string;
  numberOfSeasons: number; numberOfEpisodes: number;
  episodeRunTime: number[];                                  // TMDB returns an array
  seasons: { seasonNumber: number; episodeCount: number; name: string; airDate: string }[];
  networks: { id: number; name: string }[];
  createdBy: { id: number; name: string }[];
  // no budget/revenue/runtime
}
```

**`src/routes/tv/[seriesId]/datasource.server.ts`** — `getSeries(seriesId)`:
`GET ${TMDB_BASE}/3/tv/{id}?append_to_response=credits,external_ids&language=en-US`, `tmdbHeaders()`,
`aggregateGender(credits.cast/crew)`. Map `name`→`title`, `first_air_date`→`releaseDate` **and**
`firstAirDate`, `seasons[]` (`season_number`/`episode_count`/`name`/`air_date`), counts,
`episode_run_time`, `networks`, `created_by`, `external_ids.imdb_id ?? null`. Throw `error(status, …)`
on non-ok, same as `getMovie`.

**`src/routes/tv/[seriesId]/+page.server.ts`** — mirror movie load, **no Bechdel**:

```ts
const series = await getSeries(params.seriesId);
const dbMedia = await getOrCreateDbMedia(series);                       // adapter, see DB note
const unconsenting = await getUnconsenting(dbMedia.id);
const umCandidates = unconsenting === null ? await getUnconsentingCandidates(series) : [];
return { series, unconsenting, umCandidates, triggerTags: getTriggerTagsForSeries(series) };
```

> **DB note (no migration — the performance-and-risk-minimizing choice).** The TV page's only DB
> need is the UM lookup, keyed by the created row's UUID. To dodge the `tmdb_id`/`imdb_id` unique
> clash, widen the DB helpers to accept a small structural type and route TV through an adapter that
> writes a **namespaced synthetic imdb id and a null `tmdb_id`**:
>
> - In `db.server.ts`, change `getOrCreateDbMovie`/`getUnconsenting*` params from `Movie` to a
>   structural `MediaRef = { title; imdbId: string | null; tmdbId: string; releaseDate: string }`
>   (both `Movie` and `Series` satisfy it). One-line signature widenings — no body changes for the
>   movie path.
> - Add a thin `getOrCreateDbMedia(media: MediaRef, kind: 'movie' | 'tv' = 'movie')` wrapper (or a
>   param) that, for `tv`, forces `imdbId: media.imdbId ?? \`tmdb-tv:${media.tmdbId}\`` and
>   `tmdbId: null` before the existing insert/lookup logic. Movies are unaffected.
> - `getUnconsentingCandidates` already reads only `title` + `releaseDate` — for series, `releaseDate`
>   is the first-air date, which is exactly what UM year-matching wants.
>
> TV rows are **UM-only** (no Bechdel/DDD persistence). Document this in `architecture.md`.
> *Deferred follow-up* (only if TV ever needs seeded UM/Bechdel): add a `media_type` column +
> composite unique indexes `(tmdb_id, media_type)` / `(imdb_id, media_type)` via `db:generate`.

**`src/routes/tv/[seriesId]/+page.svelte`** — mirror `movie/[movieId]/+page.svelte`:

- **DetailHeader** (generalized — see Step 4): pass `media={series}`.
- **Fact grid:** use a new `seriesFactGrid.svelte` (fact rows differ enough from movies that
  branching `factGrid` would be messier than a sibling — Seasons / Episodes / Networks / Created by /
  First & last air date vs Budget / Revenue / Runtime).
- **Gender section:** `<GenderDistribution cast={series.cast} crew={series.crew} />` — reused as-is.
- **Bechdel section + chip:** `CollapsibleSection title="Bechdel Test" status="Not applicable"
  tone="empty" open={false}`, no source link, body "The Bechdel Test rates films, not series." Keep a
  disabled/"N/A" chip so the three-section symmetry holds. **No `getBechdel` call** anywhere in the TV load.
- **UM section:** copy the movie page's `umData = unconsenting ?? autoUm ?? selectedUm` logic verbatim
  (incl. the `$effect` that resets `selectedUm` on id change, and `umFlagCount`).
- **DDD section:** streamed exactly like movies, but renders `<DddEpisodeSelector …>` above
  `<DddTags tags={visibleTags} />` (Steps 3–4).

> **Maintainability tip:** the UM block, the streamed-DDD `$effect`, and the summary-chips markup are
> identical to the movie page. Resist re-typing them freehand — copy the movie `+page.svelte` to the
> tv route, then change only: the imported detail type (`Series`), the fact grid component, the Bechdel
> section body, and the DDD section (add selector + `visibleTags`). Everything else is line-for-line.

---

## Step 3 — DDD per-episode (`src/routes/movie/[movieId]/ddd.server.ts`, generalized in place)

Keep `getTriggerTagsLive(imdbId)` for movies. Add `getTriggerTagsForSeries(series)`. Factor the shared
`media/{id}` fetch + `yesSum >= noSum && yesSum > 0` filter into one internal helper so the rule lives once.

```ts
export interface TriggerTag {
  topicItemId: number; topicId: number; doesName: string;
  yesSum: number; noSum: number; comment: string | null;
  season: number | null;   // index1: -1 = series-level, null = unscoped, n = season n
  episode: number | null;  // index2
}
export interface DddResult { itemId: number | null; tags: TriggerTag[]; isSeries: boolean; }
```

- **TV lookup (verified):** `dddsearch?q={encodeURIComponent(series.title)}` → among items with
  `itemType.id === 16`, pick `it.tmdbid === Number(series.tmdbId)`; fall back to `releaseYear`
  == `series.firstAirDate.slice(0,4)`; else `EMPTY`. **Do not** send `imdb=` for series.
- Parse step: read `data.item?.itemType?.index1 === 'season'` → `isSeries`; map each stat's
  `index1`→`season`, `index2`→`episode` (keep all existing fields). **Filter unchanged.**
- **One fetch, no index params** (server ignores them). Cache key **prefixed** to prevent
  collisions: `imdb:${id}` (movies) / `tmdb:${id}` (series). Movies return `isSeries:false` and
  whatever season/episode the stats carry (usually null) — the movie page ignores them.

> **Sonnet 4.6 tip:** `ddd.spec.ts` is already noted stale in architecture.md §"Known gaps" #1 — its
> mocks use old field names. Don't try to make the *existing* assertions pass first; rewrite the spec
> against the *current* `TriggerTag` shape, then add: (a) a TV case asserting `index1/index2` →
> `season/episode`, (b) `q=`+`itemType.id:16`+`tmdbid` selection picks the right item, (c) the
> `yesSum < noSum` row is still dropped. Mock `fetch` (two responses: search, then media).
> **DB-perf note:** DDD is *not* persisted (`movie_trigger_tags` stays write-free per architecture.md
> §gaps #2) — this stays an in-memory cache, no DB writes added.

---

## Step 4 — Season/episode selector + client-side filtering

**`src/lib/components/movies/dddEpisodeSelector.svelte`** (new):

```ts
interface Props {
  seasons: Series['seasons'];                 // drives the season dropdown from TMDB
  tags: TriggerTag[];                          // to know which episodes actually have DDD data
  selectedSeason: number | null;              // null = whole series (default)
  selectedEpisode: number | null;             // null = whole season
  onchange: (season: number | null, episode: number | null) => void;
}
```

- Two `<select>`s styled to match `form/radioTile.svelte`/existing controls: **Season** (default
  option "Whole series", value `null`) and **Episode** (default "All episodes"; **disabled** until a
  specific season is chosen). Drop `seasonNumber === 0` (Specials) unless DDD has stats for it.
- Episode options for the chosen season = the **distinct `episode` values present in `tags`** for that
  season (DDD only annotates episodes that have data), capped by the season's `episodeCount`.
- Default = whole-series. Show a hint when whole-series is selected: "Showing series-wide warnings —
  pick a season for episode detail."

**Filtering — in the tv `+page.svelte`, a single `$derived.by`:**

```ts
const visibleTags = $derived.by(() => {
  if (!ddd) return [];
  if (selectedSeason === null) return ddd.tags.filter(t => t.season === -1 || t.season === null);
  if (selectedEpisode === null) return ddd.tags.filter(t => t.season === selectedSeason || t.season === -1);
  return ddd.tags.filter(t =>
    (t.season === selectedSeason && t.episode === selectedEpisode) || t.season === -1);
});
```

- Feed `visibleTags` to `<DddTags tags={visibleTags} />` — **`DddTags` is unchanged** (already keyed
  by the unique `topicItemId`, so episode-scoped duplicates of one topic keep distinct keys).
- The DDD **chip count** and **section status pill** read `visibleTags.length`, so switching episode
  updates them live; the default (whole-series) shows the series-wide tally.

> **Client-perf tip:** selection changes recompute one `Array.filter` over an in-memory list — **no
> network, no refetch.** Use `$derived`/`$derived.by`, not `$effect`, so Svelte 5 tracks it as pure
> reactive state (matches the house pattern; avoids effect-ordering bugs). Don't memoize beyond this —
> the list is small (hundreds of rows) and filtering is O(n).
> **Sonnet 4.6 tip:** keep `selectedSeason`/`selectedEpisode` as `$state` in `+page.svelte` and reset
> them in the same `$effect(() => { series.id; … })` that resets `selectedUm` (so a stale episode pick
> can't leak across series). The selector is controlled (props in, `onchange` out) — don't let it own
> the state.

---

## Step 5 — Generalize shared components (don't fork them)

- **`src/lib/components/movies/detailHeader.svelte`** — currently `Props { movie: Movie }` importing
  `Movie` from the movie route. Change to `Props { media: MediaDetail; children?: Snippet }` importing
  `MediaDetail` from `$lib/movie/media`. `year` derives from `media.releaseDate.slice(0,4)`. **Remove**
  the `runtime` line from the header (it's movie-only and `MediaDetail` has none) — runtime already
  lives in the movie fact grid, so no information is lost. Update the movie `+page.svelte` call site to
  `media={movie}`.
- **`src/lib/components/movies/genderDistribution.svelte`** — already takes only `cast`/`crew`; if it
  imports `GenderBreakdown` from the movie route, repoint that import to `$lib/movie/media`. No prop change.
- **`src/lib/components/movies/factGrid.svelte`** — leave as the **movie** fact grid (Budget/Revenue/
  Genres/Country/Language). Add a sibling **`seriesFactGrid.svelte`** reusing `countryName`/`languageName`
  from `$lib/movie/format` and `formatRuntime` for `episodeRunTime` (e.g. average or first entry).

> **Maintainability tip:** this is the crux of keeping the two routes from drifting. After Step 0+5, the
> *only* TV-specific UI is `seriesFactGrid.svelte`, `dddEpisodeSelector.svelte`, the Bechdel-N/A body,
> and the DDD `visibleTags` wiring. Header, gender chart, UM section, collapsible sections, and DDD tag
> table are shared verbatim. If you find yourself copying a third component, stop and generalize it instead.

---

## Step 6 — Wording

- **`src/routes/+page.svelte`** — "A film safety reference" → "A film & TV safety reference"; subhead
  "…in film" → "…in film and television"; generalize source-card "film" copy where natural (the Bechdel
  card can stay film-specific since Bechdel is films-only).
- **`src/lib/components/layout/footer.svelte`** — tagline "Movie Information Database" → "Media
  Information Database" (keeps MIDB sensible).
- **`src/lib/components/movies/umCandidates.svelte`** — "which one is this film?" → "which one is this
  title?".
- (Search placeholder + aria-label handled in Step 1.)

---

## Verification

Runtime **bun**; `$db` → repo-root `db/`. Needs `.env` (`PUBLIC_TMDB_API_URL`, `TMDB_API_TOKEN`,
`DDD_API_KEY`, DB reachable). See architecture.md "Local run sequence".

1. `bun run check` — first gate after Step 0/5 type changes; fix all TS errors before running the app.
2. `bun run dev`.
3. **Movie regression:** `/movie/550` (Fight Club) — header, all three sections, gender chart, DDD tags
   stream unchanged. Search "Fight Club" → film badge → `/movie/550`.
4. **TV happy path:** `/tv/1399` (Game of Thrones) — series header + series fact grid; Bechdel "Not
   applicable to series"; UM behaves like movies; DDD streams, defaults to whole-series, and Season 1 →
   Episode 1 narrows the list while series-level (index −1) tags stay; chip count tracks `visibleTags`.
   Confirm DDD resolves to item `678166` via the `q=` + `itemType.id:16` + `tmdbid:1399` match.
5. **Search:** "Game of Thrones" → tv badge → routes to `/tv/1399`; persons filtered out; movie/tv id
   collision doesn't break keyboard nav (distinct `optionId`s).
6. **Unit tests:** `bun run test:unit` — rewrite `ddd.spec.ts` (Step 3 tip) + add a `getSeries`
   field-mapping spec (mock fetch) mirroring the movie datasource spec.
7. **Lint caveat (architecture.md):** repo Prettier is globally dirty, so `bun run lint` reports
   pre-existing noise — rely on `bun run check`; run `prettier --write` only on files you touched.

> **Sonnet 4.6 ordering tip:** implement in this order so each step compiles before the next — Step 0
> (shared types/helpers) → Step 5 (repoint component imports; `bun run check` green) → Step 1 (search) →
> Step 3 (DDD generalization + spec) → Step 2 (tv route, depends on all above) → Step 4 (selector) →
> Step 6 (wording). Run `bun run check` after Steps 0, 3, and 2.

## Open question carried into implementation

- **DB `media_type` column** — shipping the no-migration adapter (null `tmdbId`, namespaced synthetic
  `imdbId`) now. Revisit a `media_type` column + composite unique indexes only if TV later needs its own
  seeded UM/Bechdel data. Until then, TV rows are UM-only by design.

## Files touched (summary)

| Kind | Path |
|---|---|
| new | `src/lib/movie/media.ts`, `src/lib/server/tmdb.ts` |
| new | `src/routes/tv/[seriesId]/{types.ts,datasource.server.ts,+page.server.ts,+page.svelte}` |
| new | `src/lib/components/movies/{seriesFactGrid,dddEpisodeSelector}.svelte` |
| edit | `src/routes/api/search/{datasource.server.ts,+server.ts}`, `src/lib/components/search/{types.ts,movieSearch.svelte.ts,searchResult.svelte,searchResults.svelte,searchInput.svelte}` |
| edit | `src/routes/movie/[movieId]/{datasource.server.ts,types.ts,db.server.ts,ddd.server.ts,+page.svelte}` |
| edit | `src/lib/components/movies/{detailHeader,genderDistribution,umCandidates}.svelte` |
| edit | `src/routes/+page.svelte`, `src/lib/components/layout/footer.svelte` |
| test | `src/routes/movie/[movieId]/ddd.spec.ts` (rewrite) + new `getSeries` datasource spec |
| doc | `.CLAUDE/architecture.md` (note `/tv` route, shared `MediaDetail`, TV-rows-are-UM-only) |
