# Plan: Movie Entity Database Schema & Multi-Source Seeding

## Context

The movie details page needs to display three diversity/safety metrics from three external
sources, plus the existing TMDB-sourced movie facts and gender breakdown. Today the page has a
**summary section** (`DetailHeader` + `FactGrid`) and a placeholder **metrics section**. The
existing DB schema (`movies`, `metrics`, `metric_options`, `evaluations`, `evaluation_results`)
was designed for *user-generated* ratings — a poor fit for authoritative, seeded source data.

Per the user's decision, we **disregard the existing metric/evaluation schema** and design a
clean, purpose-built schema where:

- **Bechdel Test** and **Unconsenting Media (UM)** are **seeded source-of-truth** data: one fixed
  record per movie, loaded from CSVs at seed time and stored in dedicated tables.
- **Does The Dog Die (DDD)** is **fetched live** from their API on every details-page load
  (streamed + short-TTL cached). Its trigger tags get a table that's *defined now but only written
  to later*, once user-interaction features exist.

The page's **summary section is replaced** by a summary of these 3 metrics; the **metrics
section** gains one sub-section per source, each with a link back to that source's website.

The schema is designed so the future **user** entity (auth, comments, user-submitted evaluations)
slots in cleanly without rework.

---

## Database Schema (PostgreSQL + Drizzle)

> Replaces `db/schema/metric.ts` and extends `db/schema/movie.ts`. `db/schema/auth.ts` (users)
> stays as-is for the future; new tables reference it only where noted as *future*.

### 1. `movies` — the spine (seeded from Bechdel CSV)

The Bechdel CSV is the only source carrying a reliable `imdbid` **and** `title`/`year`, so it is
the movie seed spine.

| column        | type            | notes |
|---------------|-----------------|-------|
| `id`          | uuid PK         | `defaultRandom()` — internal stable ID |
| `imdb_id`     | varchar unique  | from Bechdel `imdbid` (e.g. `tt0089755`); the cross-source join key |
| `tmdb_id`     | integer unique nullable | backfilled lazily on first page visit (or batch) |
| `title`       | varchar(255)    | from Bechdel `title` |
| `year`        | integer         | from Bechdel `year` |
| `clean_title` | varchar(255)    | normalized title (lowercased, articles/punct stripped) — index for UM matching |
| `created_at`  | timestamp       | `defaultNow()` |
| `updated_at`  | timestamp       | `defaultNow()` |

- Index on `imdb_id` (unique), `tmdb_id` (unique, partial where not null), and `clean_title`.
- `tmdb_id` nullable + backfilled: avoids resolving every Bechdel row through TMDB at seed time.

### 2. `movie_bechdel` — seeded, 1:1 with movie

| column           | type    | notes |
|------------------|---------|-------|
| `movie_id`       | uuid PK FK → movies.id (cascade) | one row per movie |
| `bechdel_id`     | integer | their `id`, used for the link URL |
| `rating`         | smallint| 0–3 (CHECK 0..3) |
| `num_votes`      | integer | from CSV `numVotes` |
| `created_at`     | timestamp |

- Link URL built in the app: `https://bechdeltest.com/view/{bechdel_id}`.
- The 4 rating tiers (0–3) and their labels are **static UI constants**, not DB rows — they never
  change. Render tiers ≤ `rating` as enabled, the rest as disabled.

### 3. `movie_unconsenting` — seeded, 1:1 with movie (matched by title)

UM has no imdb_id, so rows are matched to movies by `clean_title`. Store the 9 boolean flags as
explicit columns (queryable/indexable) rather than JSON.

| column            | type    | notes |
|-------------------|---------|-------|
| `movie_id`        | uuid PK FK → movies.id (cascade) | |
| `um_id`           | integer | their `id`, for the link URL |
| `clean_name`      | varchar | from CSV `cleanName` |
| `item_type`       | varchar | from CSV `itemType` |
| `comment`         | text    | from CSV `comment` |
| `no_rape`         | boolean | |
| `rape_men_dis_imp`| boolean | "Rape or sexual assault mentioned/discussed/implied" |
| `sex_har_on_scrn` | boolean | "Sexual harassment …" |
| `sex_adult_teen`  | boolean | "Sexual relationship between adult and teenager" |
| `child_sex_abuse` | boolean | |
| `incest`          | boolean | |
| `attempted_rape`  | boolean | |
| `rape_off_scrn`   | boolean | "Rape off-screen or strongly implied" |
| `rape_on_screen`  | boolean | |
| `created_at`      | timestamp |

- Link URL: `https://www.unconsentingmedia.org/items/{um_id}`.
- Human-readable labels for the 9 flags live as a **static UI map** (flag column → label string),
  matching the user-provided list.

### 4. `movie_trigger_tags` — DDD, **defined now, written later**

DDD tags are fetched live for display. This table exists so persistence is ready when user
features land; **no writes in this phase**.

| column          | type    | notes |
|-----------------|---------|-------|
| `id`            | serial PK | |
| `movie_id`      | uuid FK → movies.id (cascade) | |
| `topic_id`      | integer | DDD topic id |
| `does_name`     | varchar | e.g. "Does the dog die" (display label) |
| `yes_sum`       | integer | snapshot of votes when persisted |
| `no_sum`        | integer | |
| `comment`       | text    | |
| `created_by`    | text FK → users.id (*future*, nullable for now) | which user's interaction persisted it |
| `created_at`    | timestamp |

- Unique index `(movie_id, topic_id)`.
- Wired into the schema and migrations now; the write path is deferred.

### 5. Future user entity (designed-for, not built)

- Keep `db/schema/auth.ts` `users`.
- When user features arrive, add `comments` / `user_evaluations` tables referencing
  `movies.id` + `users.id`. The source tables above are user-agnostic, so nothing here needs to
  change. `movie_trigger_tags.created_by` already anticipates the FK.

---

## Seeding Strategy

New scripts under `db/scripts/`, run via new `package.json` entries (mirroring existing
`db:seed`). Place raw CSVs under `db/seeds/sources/`.

1. **`seed:movies-bechdel`** — stream-parse the Bechdel CSV; for each row upsert a `movies` row
   (`imdb_id`, `title`, `year`, computed `clean_title`) and a `movie_bechdel` row
   (`bechdel_id`, `rating`, `num_votes`). Idempotent upsert keyed on `imdb_id`. Batch inserts
   (e.g. chunks of ~1000) for throughput.

2. **`seed:unconsenting`** — stream-parse the UM CSV; compute `clean_name`/normalized title and
   match to an existing `movies` row by `clean_title`. On match, upsert `movie_unconsenting`.
   Log unmatched rows to a report file for manual review (don't create movie rows from UM —
   it lacks imdb_id).

3. **`backfill:tmdb`** *(optional batch, also done lazily)* — for movies with null `tmdb_id`,
   resolve `tmdb_id` via TMDB using `imdb_id` (TMDB `/find/{imdb_id}?external_source=imdb_id`).
   Lazy fallback: when a details page loads a movie whose `tmdb_id` is null, resolve and persist
   it then.

- Reuse the existing CSV/seed conventions and `db` connection from `db/connections.ts`.
- All upserts idempotent so seeds can re-run safely.
- Title normalization (`clean_title`) shared by movie + UM seeders — single helper in
  `db/scripts/lib/normalizeTitle.ts`.

**Critical seed-time concern:** title matching for UM is lossy. The `clean_title` normalizer must
match UM's own `cleanName`/`cleanNameArticles` conventions (lowercase, strip leading articles,
strip punctuation/whitespace). Unmatched UM rows are expected and acceptable.

---

## Application Changes (movie details page)

### Server load — `src/routes/movie/[movieId]/+page.server.ts`

The route param is currently a TMDB id. Keep that, but load DB-backed metrics by joining on
`tmdb_id` (lazily backfilling if null), and stream DDD:

```ts
export const load: PageServerLoad = async ({ params }) => {
  const movie = await getMovie(params.movieId);          // TMDB live (existing)
  const dbMovie = await getOrCreateDbMovie(movie);       // ensures movies row, backfills tmdb_id
  const bechdel = getBechdel(dbMovie.id);                // awaited (DB, fast)
  const unconsenting = getUnconsenting(dbMovie.id);      // awaited (DB, fast)
  return {
    movie,
    bechdel: await bechdel,
    unconsenting: await unconsenting,
    triggerTags: getTriggerTagsLive(movie.imdbId)        // STREAMED promise (DDD live)
  };
};
```

- New `db.server.ts` (server-only) data-access module beside the route:
  `getOrCreateDbMovie`, `getBechdel`, `getUnconsenting`.
- New DDD live client `ddd.server.ts`: two-step (`/dddsearch?imdb=` → `/media/{itemId}`), filter
  `topicItemStats` to `yesSum >= noSum`, map to `{ doesName, yesSum, noSum, comment }`. Wrap in a
  **short-TTL in-memory cache** keyed by `imdb_id` (e.g. 1h) to avoid hammering DDD on repeat
  views. Requires a private `DDD_API_KEY` env var.
- TMDB `getMovie` must also expose `imdb_id` — add `append_to_response=credits,external_ids` (or
  read `imdb_id`) so DDD/Bechdel joins have the key.

### Page — `src/routes/movie/[movieId]/+page.svelte`

- **Remove** the existing summary `<section id="details">`'s role as the page's lead and
  **replace** it with a **metrics summary** band: a compact 3-up summary (Bechdel rating chip,
  UM "N concerns flagged" chip, DDD "N trigger tags" chip). Keep `DetailHeader` for
  poster/title/year context.
- **Metrics section** — one sub-section per source, each with a "View on {source}" link:
  - **Bechdel**: render the 4 tiers; tiers `<= rating` enabled, rest disabled; show `num_votes`.
    Link → `bechdeltest.com/view/{bechdel_id}`.
  - **Unconsenting Media**: list the 9 labels with their boolean value; show `comment`.
    Link → `unconsentingmedia.org/items/{um_id}`.
  - **Does The Dog Die**: `{#await triggerTags}` skeleton → render trigger-tag chips
    (`doesName`); on hover show vote distribution (`yesSum`/`noSum`) + `comment`.
    Link → `doesthedogdie.com`.
- Keep `GenderDistribution` section.

### Static UI constants — `src/lib/movie/metrics.ts`

- `BECHDEL_TIERS`: ordered `[{ level, label }]` for the 4 rating levels (labels from the user).
- `UM_FLAGS`: ordered `[{ key, label }]` mapping the 9 columns to human-readable labels.

---

## Other Design Decisions

- **SSR vs CSR**: DB-backed metrics (Bechdel/UM) render server-side in the initial SSR payload
  (fast, indexable). DDD is streamed (SvelteKit promise-in-load) so a slow external API never
  blocks first paint. No client-side fetching needed for metrics.
- **JSON vs columns**: UM flags are explicit boolean columns (not JSONB) so they're queryable
  (e.g. future "filter movies without X") and self-documenting. DDD live data is *not* normalized
  into columns — it's ephemeral display data.
- **Identity & scalability**: internal `uuid` PK decouples us from any single external id; all
  three external ids (`imdb_id`, `tmdb_id`, `bechdel_id`/`um_id`) are stored and indexed. This
  scales to millions of rows and lets any source be re-seeded independently.
- **Idempotency**: every seeder upserts, so re-running is safe and incremental.
- **Caching**: short-TTL in-memory cache for DDD now; trivially swappable for Redis later.
- **Migrations**: generate via `bun run db:generate` (drizzle-kit) after editing schema; apply via
  `bun run db:migrate`. Existing metric/evaluation tables get a drop migration since we're
  disregarding that schema.

---

## Critical Files

- `db/schema/movie.ts` — extend `movies`; add `movie_bechdel`, `movie_unconsenting`,
  `movie_trigger_tags` (new `db/schema/` files or consolidate).
- `db/schema/metric.ts` — **remove** (superseded). Generate drop migration.
- `db/scripts/seedMovies.ts`, `db/scripts/seedUnconsenting.ts`, `db/scripts/backfillTmdb.ts` — new.
- `db/scripts/lib/normalizeTitle.ts` — new shared helper.
- `db/connections.ts` — update schema imports.
- `package.json` — add `db:seed:movies`, `db:seed:um`, `db:backfill:tmdb` scripts.
- `src/routes/movie/[movieId]/+page.server.ts` — load Bechdel/UM (DB) + stream DDD.
- `src/routes/movie/[movieId]/db.server.ts` — new DB access module.
- `src/routes/movie/[movieId]/ddd.server.ts` — new live DDD client + cache.
- `src/routes/movie/[movieId]/datasource.server.ts` — expose `imdb_id` from TMDB.
- `src/routes/movie/[movieId]/+page.svelte` — metrics summary + per-source sections.
- `src/lib/movie/metrics.ts` — `BECHDEL_TIERS`, `UM_FLAGS` constants.
- `.env` — add `DDD_API_KEY`.

---

## Implementation Tips for Sonnet 4.6

Notes tuned to how Sonnet 4.6 tends to work this codebase. Follow them to avoid the common
failure modes and rework loops.

### Build order (do it in this sequence — don't jump ahead)

1. **Schema first, in isolation.** Edit `db/schema/*`, update `db/connections.ts` imports, then
   run `bun run db:generate` and read the generated SQL in `db/migrations/` **before** running
   `db:migrate`. Confirm the drop of `metrics`/`metric_options`/`evaluations`/`evaluation_results`
   is present and the new tables/indexes look right. Only then `db:migrate`.
2. **Normalizer + its unit test next.** Write `normalizeTitle.ts` and a `vitest` test with a
   handful of real UM titles (articles, punctuation, accents) **before** the seeders — the seeders
   are worthless if the match key is wrong, and this is the single most error-prone piece.
3. **Seeders.** Movies/Bechdel seeder, then UM seeder. Run against a **small sliced CSV first**
   (head -200), verify, then the full file.
4. **DDD live client + cache, with a unit test** against the Old Yeller sample in the task.
5. **Server load + page UI last.**

Do **not** batch all of this into one giant edit pass. Land + verify each layer.

### Codebase-specific gotchas (these will bite if ignored)

- **Svelte 5 runes only.** This repo uses `$props`, `$derived`, `$state`. No `export let`, no
  legacy stores in new components. Match `+page.svelte` and existing `$lib/components/movies/*`.
- **`.svelte.ts` import extension trap** (see project memory): when importing a `*.svelte.ts`
  module from a component, use an explicit `.js` extension or Vite resolves the component instead.
  Relevant if you add any runes-based state module.
- **Poster perf trap** (project memory): never reuse the full-res `Image` component for list/grid
  thumbnails — build a fixed `w92` URL. The metrics summary chips don't need posters, but if you
  add any movie thumbnail, honor this.
- **Server-only boundary.** DB access and API keys must live in `*.server.ts` files only
  (`db.server.ts`, `ddd.server.ts`, `datasource.server.ts`). Never import `db/connections.ts` or
  read `$env/static/private` from a `.svelte` or non-`.server` module — it leaks to the client and
  SvelteKit will error.
- **Runtime is Bun.** Seed/migrate scripts run under `bun` (see `db:seed`/`db:migrate` scripts),
  not node. Use Bun-compatible CSV streaming; mirror the existing `db/scripts/seed.ts` style
  (`@loom-io/fs`, direct `db` import, `process.exit(0)` at the end).
- **Drizzle upserts.** Use `.onConflictDoUpdate({ target: movies.imdbId, set: {...} })` for
  idempotency. The existing `seed.ts` uses a try/insert-catch/update pattern — prefer real
  `onConflict` here; it's cleaner and atomic.

### Streaming + load function (easy to get subtly wrong)

- Return the DDD promise **un-awaited** from `load` so SvelteKit streams it; `await` it in the
  template with `{#await triggerTags}`. If you accidentally `await triggerTags` in `load`, the
  whole page blocks on DDD — exactly what we're avoiding.
- `bechdel` and `unconsenting` are DB reads — **await** those in `load` (they're fast and we want
  them in the SSR HTML).
- Guard every external/DB miss: a movie with no Bechdel/UM row, a DDD 404, or a null `imdb_id`
  must render a graceful "no data" state, not throw. Many Bechdel-seeded movies will have **no** UM
  row, and DDD won't have every film.

### Verification discipline

- After the schema step, before writing any app code, run `bun run check` to confirm Drizzle types
  resolve. Don't proceed on red types.
- Scope Prettier/ESLint to changed files only (project memory: repo Prettier is dirty across ~81
  files, so a full `bun run lint` always fails — that failure is pre-existing, not yours).
- For the browser check, the Playwright browser is missing (project memory) — drive the system
  Chrome channel instead.

### Scope discipline

- This phase is **schema + seeding + display**. Do **not** implement DDD persistence, user auth,
  comments, or user-submitted evaluations. `movie_trigger_tags` is defined but **never written**.
  If you find yourself adding a write path for it, stop — that's the next phase.
- Don't preserve the old `metrics`/`evaluations` tables "just in case." The user explicitly chose a
  clean slate; the drop migration is intended.

---

## Verification

1. **Schema/migrations**: `bun run db:generate` produces a clean migration; `bun run db:migrate`
   applies it against the local Postgres (`DB_CONNECTION`). Inspect tables exist with expected
   columns/constraints (`\d movies`, `\d movie_bechdel`, etc.).
2. **Seeding**: run `db:seed:movies` then `db:seed:um` against sample CSV slices; assert row
   counts, spot-check a known title (e.g. an imdb_id from the CSV) has correct `rating`/`num_votes`
   and a matched UM row. Review the unmatched-UM report.
3. **DDD live client**: unit-test the filter (`yesSum >= noSum`) and the two-step fetch against the
   sample response in the task description (Old Yeller). Confirm cache returns same object within
   TTL without a second fetch.
4. **Page (end-to-end)**: run the app (`bun run dev`), open a movie known to be in all sources;
   confirm the metrics summary band + all three sub-sections render, Bechdel tiers enable/disable
   correctly, UM labels/values + comment show, DDD tags appear after the streamed skeleton and
   show vote distribution + comment on hover, and each source link points to the right URL.
   (Per project memory: Playwright browser is missing — use the system Chrome channel for any
   browser-driven check.)
5. **Lint/types**: `bun run check` for types. (Per project memory: repo Prettier is dirty across
   many files, so a full `lint` will report pre-existing failures — scope checks to changed files.)
