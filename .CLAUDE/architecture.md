# MIDB — Architecture Reference

> Snapshot as of 2026-06-03 (branch `chore/dependencies-update`): the **movie detail page was re-architected around a multi-source metrics model** — the old user-generated `metrics`/`evaluations` schema was **dropped** (migration 0006) and replaced by **seeded source-of-truth tables** (`movie_bechdel`, `movie_unconsenting`) + a **live-fetched, streamed** Does-The-Dog-Die client, all hung off an extended `movies` spine seeded from the Bechdel CSV. The detail page is now a redesigned, **collapsible** card layout: a header that fuses poster + title + metric **summary chips** + fact grid, three collapsible metric sections, and a plain cast/crew gender section. The `/movie/[movieId]/metric/*` route tree was **deleted**. Earlier work (landing page + theme toggle, live inline `/api/search`, global nav/footer, Svelte 5 / Vite 8 / Tailwind 4 / Storybook 9 stack) still stands. Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for displaying movies through a **diversity / content-safety lens**. Users find a movie and see how it scores across structured **metrics** — formal tests and content advisories for representation and harm. Three sources are wired today: the **Bechdel Test**, **Unconsenting Media** (sexual-violence advisories), and **Does The Dog Die** (crowd-sourced trigger tags).

Movie facts (poster, overview, release date, credits) are **not stored** — they're fetched live from **TMDB** on each request. What *is* stored locally is a thin movie spine plus the **seeded, authoritative metric data** (Bechdel rating, UM advisory flags). DDD data is fetched live and streamed, not persisted. The original vision of *user-submitted* evaluations is **deferred** — the schema and routes that supported it were removed in favor of this authoritative, seeded model (a future user/comments layer is designed-for but not built; see Known gaps).

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2.21 + **Svelte 5** (runes: `$props`/`$state`/`$derived`, snippets; SSR + client hydration) |
| Runtime / package manager | **Bun** (project is "only tested with Bun"; lockfile is JSON `bun.lock`, not the old binary `bun.lockb`) |
| Build / dev | **Vite 8** (`@sveltejs/adapter-auto` 7) |
| Styling | **Tailwind CSS 4 (CSS-first)** via `@tailwindcss/vite` — no PostCSS config; design tokens live in `src/app.css`. Remixicon for icons. (See **Styling & theming**.) |
| Database | PostgreSQL via **Drizzle ORM** 0.45 (`postgres-js` 3.4 driver) + drizzle-kit 0.31 |
| Auth | **Hanko** (passwordless / passkeys) via `@teamhanko/hanko-elements` 2.6; JWT verified with `jose` 6 |
| External movie data | **TMDB** REST API v3 (Bearer-token auth); **Does The Dog Die** API (live trigger tags, `X-API-KEY`) |
| Seed parsing | **`csv-parse`** 6 (stream-parse the Bechdel + UM source CSVs); `marked` 18 (any markdown) |
| Testing | Vitest 4 (unit), Playwright (integration), Storybook 9 (component dev) |
| Lint | ESLint 10 (flat config) + `@typescript-eslint/*` 8 + Prettier |

Other notable deps: `nanoid` 5 (element ids), `rxjs` 7.8, `nodemailer` 8; `@faker-js/faker` + `@loom-io/fs` (dev, used by seeding).

---

## High-level data flow

```
                  ┌────────────────────────────────────────────┐
   Browser  ──►   │  SvelteKit server (hooks + load functions)  │
                  └──────┬──────────────┬──────────────┬────────┘
                         │              │              │
            live fetch ┌─▼────────┐ ┌───▼──────┐ ┌─────▼───────┐
             per req.  │  TMDB    │ │   DDD    │ │  PostgreSQL │
                       │  API v3  │ │   API    │ │  (Drizzle)  │
                       └──────────┘ └──────────┘ └─────────────┘
                         ▲            ▲ (streamed,   ▲
              poster / overview /     │  1h cache)   │  seeded source data:
              credits / imdb_id    trigger tags    movies spine + Bechdel + UM

   Auth:  Browser ⇄ Hanko Cloud (web components + JWT cookie)
          hooks.server.ts verifies the `hanko` cookie via remote JWKS
```

- **Entry point** is the landing page at `/` (hero + search UX). The hero search is a **live, inline TMDB search**: typing queries a server proxy (`/api/search`) and renders a results dropdown in place — there is no `/search` page (see Routes & the Live search section).
- **Movie identity** flows by **TMDB id** through the URL (`/movie/[movieId]`), but the internal join key across metric sources is **`imdb_id`** (the Bechdel/DDD key). On a detail-page load, the live TMDB movie is resolved to a local `movies` row via `getOrCreateDbMovie` (matching on `tmdb_id` then `imdb_id`, lazily backfilling `tmdb_id`).
- **Metric data** comes from three places: **Bechdel + UM** are seeded into Postgres and rendered server-side (SSR); **DDD** is fetched live from its API and **streamed** so a slow external call never blocks first paint.
- **Auth** is entirely Hanko's; the app only verifies the JWT cookie server-side to gate `/user/*`. (No detail-page feature currently requires auth.)

---

## Directory layout

```
MIDB/
├── db/                         # Data layer — lives OUTSIDE src/, aliased as $db/*
│   ├── connections.ts          # Drizzle init + migrateDatabase(); registers ONLY movie + auth schema
│   ├── schema/                 # Drizzle table definitions (drizzle-kit reads ./schema/**/*.ts)
│   │   ├── movie.ts            # movies (extended spine) + movieBechdel + movieUnconsenting + movieTriggerTags
│   │   ├── metric.ts           # ORPHANED — old metrics/options/evaluations defs; tables dropped (migr. 0006),
│   │   │                       #   no longer imported by connections.ts. Safe to delete (see Known gaps).
│   │   └── auth.ts             # user  (matches the Hanko/Auth.js-era `user` table)
│   ├── scripts/
│   │   ├── migrate.ts          # `bun run db:migrate` → calls migrateDatabase()
│   │   ├── seed.ts             # `bun run db:seed` (legacy metrics seeder — targets dropped tables)
│   │   ├── seedMovies.ts       # `db:seed:movies` — Bechdel CSV → movies spine + movie_bechdel
│   │   ├── seedUnconsenting.ts # `db:seed:um` — UM CSV matched by clean_title → movie_unconsenting
│   │   ├── backfillTmdb.ts     # `db:backfill:tmdb` — fill null tmdb_id via TMDB /find
│   │   └── lib/                # normalizeTitle.ts (shared match key + spec) + checkCsvColumns.ts
│   ├── seeds/
│   │   ├── sources/            # raw CSVs: bechdel.csv, unconsenting.csv, unconsenting_unmatched.txt (report)
│   │   └── prod/metrics/       # legacy metric seed (bechdel.yml) for the old seed.ts
│   └── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots
│
├── src/
│   ├── hooks.server.ts         # Auth gate: verifies `hanko` JWT cookie, protects /user/*
│   ├── app.css                 # Tailwind v4 entry + design tokens + @layer components (see Styling)
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── routes/                 # File-based routing (see below)
│   │   └── +layout.svelte      # Svelte-5 root shell: app.css + remixicon, global Navbar + <main> + Footer
│   └── lib/
│       ├── components/         # Reusable UI, grouped by domain (incl. layout/, feedback/)
│       ├── movie/             # Client-safe pure helpers — format.ts (Intl …) + metrics.ts (BECHDEL_TIERS/UM_FLAGS) + specs
│       ├── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│       └── stores/             # (debounced.ts)
│
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, dialect/credentials)
├── svelte.config.js            # adapter-auto; alias $db/* → ./db/*; vitePreprocess({ style:false })
├── vite.config.ts              # tailwindcss() + sveltekit() + svelteTesting() + Vitest block
├── tailwind.config.js          # LEGACY Tailwind-v3 file — no longer the theme source (see Styling)
└── .env                        # DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN, DDD_API_KEY
```

**Key structural choice:** the database layer (`db/`) sits *outside* `src/`, exposed to the app via the `$db/*` alias defined in `svelte.config.js`. Server-only route modules import `db` from `$db/connections`.

> **`db/schema/metric.ts` is orphaned.** Migration 0006 dropped the `metrics`/`metric_options`/`evaluations`/`evaluation_results` tables, and `connections.ts` now registers only `movieSchema` + `authSchema`. The file still exists on disk (and still references `users`/`movies`) but is dead — it is not part of the active schema. The plan called for deleting it; that deletion is still pending.

> There is **no `postcss.config.js`** — it was removed in the Tailwind v4 migration; `@tailwindcss/vite` handles CSS directly in the Vite pipeline.

---

## Styling & theming

The styling system is **Tailwind CSS v4, CSS-first**. There is no JS theme config in the build path — the source of truth is `src/app.css`.

- **Entry & tokens.** `app.css` begins with `@import "tailwindcss"`. Build-time design tokens (breakpoints, spacing) are declared in a `@theme { … }` block. Semantic *colors* are exposed to Tailwind utilities through **`@theme inline { --color-*: var(--*) }`** — the `inline` form means the utilities re-resolve their underlying CSS variables at render time, so a theme switch re-cascades without rebuilding.
- **Design-token system.** `app.css` defines raw palette ramps (`--rv-*` purple "revolution", `--aq-*` aqua) and a set of **semantic tokens**: `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--brand`, `--brand-strong`, `--accent`, `--accent-bg`, `--accent-ink`, `--border`, plus status tokens `--secondary`/`--success`/`--warn`/`--danger`/`--info`, each with `-soft` (hover) and `-fg` (on-color text) variants. A `--font-display` (Fraunces) is exposed too. A purpose-specific **`--seg-male`** token (defined per-theme: lilac `#c890ee` light / gold `#fcd34d` dark, exposed as `--color-seg-male`) gives the gender chart's "men" segment a distinct, non-blue colour that survives the theme switch.
- **Three theming layers**, in cascade order:
  1. `:root` — light defaults.
  2. `@media (prefers-color-scheme: dark) :root:not([data-theme])` — system dark, applied **only when there is no manual override**.
  3. `:root[data-theme="light"]` / `:root[data-theme="dark"]` — manual overrides set by the theme toggle (writes `document.documentElement.dataset.theme`).
- **Component layer.** `@layer components` styles `body` (`bg-surface text-ink`, `color-scheme: light dark`), `::selection`, `.bg-component`, `h1`/`h2`, `.label`, `.display`.
- **`tailwind.config.js` is a vestigial Tailwind-v3 leftover.** It still defines a colors/spacing/screens theme, but under v4 **it is not read for theming** — do not treat it as the active source of truth. The live tokens are the `@theme` blocks in `app.css`.
- **Svelte `<style>` blocks** use `<style lang="postcss">` with `@reference "…/app.css"` at the top so `@apply` resolves the v4 tokens. `svelte.config.js` sets `vitePreprocess({ style: false })`: this stops vitePreprocess from running its own PostCSS pass (which would resolve a bun-cached Tailwind v3) and hands style processing to `@tailwindcss/vite`, while keeping `lang="postcss"` recognised by svelte-check.

---

## Routes

SvelteKit file-based routing under `src/routes/`. Server-only logic lives in `+page.server.ts` / `*.server.ts` (suffix = never shipped to client). The root `+layout.svelte` is the Svelte-5 shell: imports `app.css` + remixicon and renders a `flex flex-col min-h-screen` page chrome — a global `<Navbar>` (header), `<main class="flex-1 max-w-5xl mx-auto px-md">{@render children()}</main>`, and a global `<Footer>` (so every route gets nav + footer; the footer always sticks to the bottom on short pages). The nav/footer live in `lib/components/layout/` (see Component library).

| Route | Files | Status | Notes |
|---|---|---|---|
| `/` | `+page.svelte`, `+page.server.ts` | **Working (landing)** | Real landing page: `TopBar` (logo + theme toggle + "Sign in"), hero ("Know before you watch."), `HeroSearch` (now a live inline search — see below), a 3-up metrics band, footer. `+page.server.ts` returns `{}`. |
| `/api/search` | `+server.ts`, `datasource.server.ts` | **Working (endpoint)** | `GET ?q=…` proxy to TMDB `search/movie` using the server-only `TMDB_API_TOKEN` (first authenticated TMDB call in the repo). Empty/whitespace `q` short-circuits to `{ results: [] }`; TMDB failures are caught, logged via `console.warn`, and also return `{ results: [] }` (never 500s the UI). Returns a slim `SearchResult[]` shape. No `/search` *page* exists — search is inline-only. |
| `/auth` | `+page.svelte`, `+page.ts`, `+layout.svelte` | Working | Renders Hanko `<hanko-auth>`. On success redirects to `/user/dashboard`. `ssr=false`. Layout centers the widget. |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts`, `db.server.ts`, `ddd.server.ts`, `types.ts` (+ `*.spec.ts`) | **Working (multi-source detail page)** | The core page (see **Movie detail page** below). `load` fetches the movie **live from TMDB** by id (e.g. `/movie/550`, `Bearer`, `append_to_response=credits,external_ids`, `throw error()` on non-ok), resolves/creates the local `movies` row (`getOrCreateDbMovie`), **awaits** Bechdel + UM from Postgres (fast, SSR), and returns the **DDD trigger-tags promise un-awaited** so SvelteKit streams it. Renders a redesigned header (poster + title + **metric summary chips** + fact grid), three **collapsible** metric sections (`#bechdel`, `#unconsenting`, `#ddd`), and a plain `#gender` section. |
| `/user/dashboard` | `+page.svelte`, `+page.ts` | Working (minimal) | Hanko `<hanko-profile>` widget. Auth-gated by `hooks.server.ts`. `ssr=false`. |

> **Removed routes:** the `/movie/[movieId]/metric` and `/movie/[movieId]/metric/[metricId]` tree (user-driven metric evaluation forms) was **deleted** in this work — the app moved from user-submitted evaluations to seeded source data. The old `metrics`-tiles list and the sequential-checkbox evaluation form no longer exist.
>
> Routing history note: an earlier merge introduced a parallel `/movie/[id]/...` tree that conflicted with `/movie/[movieId]/...`; these were consolidated onto **`[movieId]`** — still the single canonical movie param name.

---

## Database schema

The **active schema is entirely in `db/schema/movie.ts`** (+ `auth.ts` for `user`). It models a thin movie spine joined 1:1 to **seeded, authoritative metric data**, plus a defined-but-unwritten table for future DDD persistence. `connections.ts` registers only `movieSchema` + `authSchema` with `drizzle()`, enabling Drizzle's relational query API for those.

> The old user-evaluation model (`metrics`, `metric_options`, `evaluations`, `evaluation_results`) was **dropped in migration 0006** and is no longer part of the schema. `db/schema/metric.ts` is an orphaned leftover (see Directory layout note).

### Tables (active)

**`movies`** (`movie.ts`) — the spine; seeded from the Bechdel CSV, enriched lazily from TMDB.
- `id` uuid PK (`defaultRandom`), `imdb_id` varchar **unique NOT NULL** (cross-source join key, e.g. `tt0137523`), `tmdb_id` integer **unique nullable** (backfilled lazily on first visit or via `db:backfill:tmdb`), `title` varchar(255), `year` integer, `clean_title` varchar(255) (normalized title — the UM match key), `created_at`, `updated_at`.

**`movie_bechdel`** (`movie.ts`) — seeded, **1:1 with movie**.
- `movie_id` uuid **PK** → `movies.id` (cascade), `bechdel_id` integer (their id, for the link URL), `rating` smallint (**CHECK 0..3** — `rating_range`), `num_votes` integer, `created_at`.
- Link URL built in-app: `https://bechdeltest.com/view/{bechdel_id}`. The 4 rating tiers are **static UI constants** (`BECHDEL_TIERS`), not DB rows.

**`movie_unconsenting`** (`movie.ts`) — seeded, **1:1 with movie**, matched by `clean_title` (UM has no imdb_id).
- `movie_id` uuid **PK** → `movies.id` (cascade), `um_id` integer (link URL), `clean_name` varchar, `item_type` varchar, `comment` text, + **9 boolean advisory-flag columns**: `no_rape`, `rape_men_dis_imp`, `sex_har_on_scrn`, `sex_adult_teen`, `child_sex_abuse`, `incest`, `attempted_rape`, `rape_off_scrn`, `rape_on_screen`; `created_at`.
- Stored as explicit boolean columns (not JSONB) so they stay queryable. Human-readable labels live as a **static UI map** (`UM_FLAGS`). Link URL: `https://www.unconsentingmedia.org/items/{um_id}`.

**`movie_trigger_tags`** (`movie.ts`) — DDD, **defined now, NOT written yet**.
- `id` serial PK, `movie_id` uuid → `movies.id` (cascade), `topic_id` integer, `does_name` varchar, `yes_sum` integer, `no_sum` integer, `comment` text, `created_by` text → `user.id` (*future*, nullable), `created_at`.
- **Unique index `movie_trigger_tags_movie_topic_idx`** on (`movie_id`, `topic_id`). The write path is deferred to a future user-interaction phase; today DDD tags are fetched live and never persisted.

**`user`** (`auth.ts`) — `id` text PK, `name`, `email`, `emailVerified`, `image`.
- Carried over from the earlier Auth.js setup; retained for Hanko + the *future* `movie_trigger_tags.created_by` FK. (Hanko is the live auth provider.)

### Migrations
- Managed by **drizzle-kit**; SQL + snapshots in `db/migrations/`, tracked in `meta/_journal.json`. `drizzle.config.ts` uses `dialect: "postgresql"` and schema glob `./db/schema/**/*.ts`.
- Chain: `0000_closed_rictor` (movies) → `0001_bright_tenebrous` (Auth.js tables) → `0002_wealthy_trauma` (metrics/options/evaluations) → `0003_robust_black_bird` (Bechdel seed, custom SQL) → `0004_wet_menace` (rename + NOT NULL) → `0005_complete_swarm` (breakpoints) → **`0006_panoramic_vivisector`** — the multi-source migration: **creates** `movie_bechdel` / `movie_unconsenting` / `movie_trigger_tags` (+ FKs, the topic unique index, the rating CHECK), **extends** `movies` (`imdb_id` unique NOT NULL, `year`, `clean_title`, `title` NOT NULL), and **drops** `evaluation_results`, `evaluations`, `metric_options`, `metrics`.
- **Migrations do NOT auto-run on dev startup** — `connections.ts` exposes `migrateDatabase()` but doesn't call it at import time. Run `bun run db:migrate` explicitly.
- ⚠️ **drizzle-kit still globs `db/schema/**/*.ts`, including the orphaned `metric.ts`.** Re-running `db:generate` will likely try to *recreate* the dropped metric tables (since they're still in `metric.ts` but absent from the latest snapshot). Delete `metric.ts` before generating the next migration.

---

## Query patterns

All DB access is server-side (`*.server.ts`). The detail page's DB access lives in **`src/routes/movie/[movieId]/db.server.ts`** (imports `db` from `$db/connections`):

- `getOrCreateDbMovie(movie)` — resolves the live TMDB movie to a local `movies` row: tries `tmdb_id` first (fast path after first visit), then `imdb_id`, **backfilling** the missing id on a hit; otherwise **inserts** a new row (using `tmdb:{id}` as a synthetic `imdb_id` when TMDB has none). Returns the row whose `id` is the FK used by the metric tables.
- `getBechdel(movieId)` / `getUnconsenting(movieId)` — `db.query.movieBechdel.findFirst` / `movieUnconsenting.findFirst` by `movie_id`, returning `… ?? null` so a missing row is a graceful "no data" state (most movies have **no UM row** — the UM seed is sparse, ~2.6k of ~9.7k movies).
- Seeders (`seedMovies.ts`, `seedUnconsenting.ts`, `backfillTmdb.ts`) use idempotent `db.insert().onConflictDoUpdate(...)` batched writes — see Seeding.

> Drizzle's relational `with:` eager-loading is no longer exercised (it powered the dropped metric/options queries); current reads are simple `findFirst`/`findMany` by indexed key.

---

## Seeding (multi-source)

Raw CSVs live under `db/seeds/sources/`. Scripts run under **Bun** (`bun ./db/scripts/<x>.ts`), use `csv-parse` for streaming, and import `db` directly from `$db/connections`. All upserts are idempotent (`onConflictDoUpdate`) so seeds re-run safely.

1. **`db:seed:movies`** (`seedMovies.ts`) — stream the **Bechdel CSV** (the only source with a reliable `imdb_id` + `title`/`year`, so it's the spine). For each row, upsert a `movies` row (`imdb_id`, `title`, `year`, computed `clean_title`) and a `movie_bechdel` row (`bechdel_id`, `rating`, `num_votes`). Idempotent on `imdb_id`, batched for throughput.
2. **`db:seed:um`** (`seedUnconsenting.ts`) — stream the **UM CSV**, normalize each title, and match to an existing `movies` row by `clean_title` (UM has no imdb_id). On match, upsert `movie_unconsenting` (the 9 flags + comment). Unmatched rows are **expected** (UM is sparse) and logged to `db/seeds/sources/unconsenting_unmatched.txt` for manual review — it does **not** create movie rows from UM.
3. **`db:backfill:tmdb`** (`backfillTmdb.ts`) — for movies with null `tmdb_id`, resolve via TMDB `/find/{imdb_id}?external_source=imdb_id` and persist. Also done **lazily** by `getOrCreateDbMovie` on first page visit.

- **`db/scripts/lib/normalizeTitle.ts`** is the shared match-key helper (lowercase, strip leading articles, strip punctuation/whitespace) — it must mirror UM's own `cleanName` conventions or matching silently fails. It has a unit spec (`normalizeTitle.spec.ts` at the lib root and/or under `db/scripts/lib`). `checkCsvColumns.ts` is a dev helper for inspecting CSV headers.
- The **legacy** `db:seed` (`seed.ts`, fed by `db/seeds/prod/metrics/bechdel.yml`) targets the **dropped** metric tables and is effectively dead.

---

## Movie detail page (`src/routes/movie/[movieId]/`)

The flagship page. A single scrolling layout, server-rendered for DB metrics and **streamed** for the live DDD call.

**Server (`+page.server.ts`):**
```ts
const movie = await getMovie(params.movieId);        // TMDB live (Bearer, credits+external_ids)
const dbMovie = await getOrCreateDbMovie(movie);      // resolve/create movies row, backfill tmdb_id
const [bechdel, unconsenting] = await Promise.all([   // DB, fast → in SSR HTML
  getBechdel(dbMovie.id), getUnconsenting(dbMovie.id),
]);
return { movie, bechdel, unconsenting,
         triggerTags: getTriggerTagsLive(movie.imdbId) };  // UN-awaited → streamed
```

**DDD live client (`ddd.server.ts`):** `getTriggerTagsLive(imdbId)` does a two-step fetch against the DDD API with `X-API-KEY: DDD_API_KEY` (private env): `/dddsearch?imdb={id}` → `/media/{itemId}`. It filters `topicItemStats` to `yesSum >= noSum && yesSum > 0` and maps to `TriggerTag { topicItemId, topicId, doesName, yesSum, noSum, comment }`. **Field-name gotcha:** the API returns `TopicId` (PascalCase) and a top-level `comment`; `topicItemId` is the unique per-row id used as the `{#each}` key. Wrapped in a **1h in-memory `Map` cache** keyed by `imdb_id` (returns the same object within TTL; `_testExports()` exposes the cache for tests). `EMPTY`/null-imdb and non-ok responses degrade to `{ itemId: null, tags: [] }`.

**Page (`+page.svelte`) — the rendered structure:**
- **`#details` header** (via `detailHeader.svelte`, which takes a `children` snippet): poster on the left; on the right, title + year/runtime meta, then **metric summary chips**, then the **fact grid** (the fact grid was moved *into* the header's right column to fill dead space — and **spoken languages was dropped**; remaining facts: budget, revenue, genres, country, language). The chips are anchor links (`#bechdel`/`#unconsenting`/`#ddd`) with an icon, label, and big Fraunces value, tinted by state (gradient when data, muted when "No data"). A hairline divider separates chips from facts.
- **Three collapsible metric sections** (`collapsibleSection.svelte`, native `<details>`/`<summary>`): `#bechdel` (4 tiers, enabled ≤ rating, vote count + source link), `#unconsenting` (9 flag rows, warning icon on present concerns, comment block + source link), `#ddd` (streamed). Each shows a **status pill** in the summary row and defaults open when it has data.
- **DDD tags** (`dddTags.svelte`): while the promise is pending, the page renders skeleton rows; once resolved, a table where each row is *name + a yes/no vote bar + the `yes / no` counts* (red = yes-share, green track). Rows with a comment are keyboard-focusable `<button>`s that reveal the comment via a **single shared, JS-positioned tooltip** (`position: fixed`, flips above/below the row, dismissed on scroll/resize). The page resolves the streamed promise into reactive `$state` via an `$effect` so the chip and section read one settled value (a `$derived` that re-wraps the promise with `.catch()` re-created it on every update and left a second `{#await}` stuck pending — that bug is why this is an `$effect`, not a derived).
- **`#gender` section** — pulled **out** of the collapsible stack and rendered as a plain `<section>` with a `.label` heading (it's context, not a metric): `genderDistribution.svelte` stacked bar + legend (counts aggregated server-side). Men use a dedicated `--seg-male` token (lilac in light, gold in dark) to stay distinct from the brand-purple women segment without any blue.

**Static UI constants** live in `src/lib/movie/metrics.ts`: `BECHDEL_TIERS` (4 `{ level, label }`) and `UM_FLAGS` (9 `{ key, label }` mapping the boolean columns to human-readable labels).

> Tests: `datasource.spec.ts`, `ddd.spec.ts`, plus `normalizeTitle`/`format` specs. **Note:** `ddd.spec.ts` mocks still use the pre-fix field names (`topicId`/`mediaItemComment`) and need updating to match the live client's `TopicId`/`comment` mapping before the suite is green.

---

## Auth flow (Hanko)

Passwordless auth via **Hanko Cloud** (tenant URL in `PUBLIC_HANKO_API_URL`). Hanko ships **web components** (`@teamhanko/hanko-elements` 2.6), registered client-side.

1. **Login** — `/auth` renders `<hanko-auth>` (via `hankoAuth.svelte`, which calls `register(PUBLIC_HANKO_API_URL)` in `onMount`). On the success event the page `goto("/user/dashboard")`.
2. **Session** — Hanko sets a `hanko` JWT cookie.
3. **Gate** — `src/hooks.server.ts` runs on every request: reads the `hanko` cookie, builds a remote JWKS from `${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`, and `jwtVerify()`s it with `jose`. Any `/user/*` path with an invalid/absent token → `redirect(303, "/auth")`.
4. **Profile** — `/user/dashboard` renders `<hanko-profile>` (manage passkeys/email).
5. **Logout** — `logoutButton.svelte` constructs a Hanko client and calls logout, then redirects.

Components: `src/lib/components/auth/{hankoAuth,hankoProfile,logoutButton}.svelte`.

> Auth history: the repo migrated **from Auth.js (NextAuth) to Hanko**. Migration `0001` created Auth.js tables; a later migration keeps only `user`. Leftover `@auth/*` deps and SMTP/`AUTH_SECRET` env vars were dropped/are unused.

---

## TMDB integration

- `src/routes/movie/[movieId]/datasource.server.ts` — `getMovie(movieId)` fetches `${PUBLIC_TMDB_API_URL}/3/movie/{id}?append_to_response=credits,external_ids&language=en-US` **authenticated** (`Authorization: Bearer ${TMDB_API_TOKEN}` from `$env/static/private`), `throw error(response.status, …)` on a non-ok response, and maps the response onto an **extended `Movie`** — including **`imdbId`** (from `external_ids.imdb_id`, the DDD/Bechdel join key) plus budget, revenue, genres, origin country, original/spoken languages, runtime, tagline, overview, `posterPath: string \| null`. Cast/crew **gender counts are aggregated server-side** by the exported `aggregateGender` helper (0=unknown/1=female/2=male/3=non-binary → a `GenderBreakdown`) so the ~225 raw credits never cross the wire. `Movie`/`GenderBreakdown` types live in a sibling **non-server `types.ts`** (re-exported by the datasource) so client components import types without touching a `*.server.ts`. (`datasource.spec.ts` covers the mapping/aggregation.)
- `src/routes/movie/[movieId]/ddd.server.ts` — the **Does The Dog Die** live client (see Movie detail page): two-step fetch with `X-API-KEY: DDD_API_KEY`, 1h in-memory cache. Distinct from TMDB; the only non-TMDB external data source.
- `src/routes/api/search/datasource.server.ts` — `searchMovies(query)` calls `${PUBLIC_TMDB_API_URL}/3/search/movie` (`include_adult=false`, `language=en-US`, `page=1`) **with** `Authorization: Bearer ${TMDB_API_TOKEN}` (from `$env/static/private`). Returns `{ results: [] }` on a non-ok response. Shares the `SearchResult` type with the client via `$lib/components/search/types`.
- Images: `src/lib/components/movies/image.svelte` builds responsive `srcset` URLs from `PUBLIC_TMDB_IMAGE_URL` (e.g. `.../t/p` + `w200/w300/.../original` + poster path) and accepts an optional **`imgSizes`** prop (named to avoid colliding with the module-scope `sizes` array) plus `decoding="async"`; its `src` defaults to **`w500`** (not `original`) so the fallback candidate stays bounded. `detailHeader.svelte` passes `imgSizes="(max-width: 768px) 40vw, 300px"`. **Search result thumbnails still do NOT use this component**: `search/resultPoster.svelte` builds a fixed `w92` URL directly to keep a 20-row, 40×60px result list cheap.

---

## Component library (`src/lib/components/`)

Organized by domain; most have a companion `*.stories.svelte` (Storybook) and some `*.spec.ts`. Components now use **Svelte 5 runes** (`$props`/`$state`/`$derived`, snippets).

| Group | Components | Purpose |
|---|---|---|
| `theme/` | themeToggle | Light/dark switch (see mechanics below) — **new** |
| `layout/` | navbar, footer | **Global app chrome**, mounted in the root `+layout.svelte` (every route). `navbar` = wordmark + `ThemeToggle` + Sign in (extracted from `landing/topBar`); `footer` = brand wordmark + Home/Sign in links. **new** |
| `landing/` | topBar, heroSearch | Landing-page chrome: `heroSearch` is a thin wrapper that renders `search/movieSearch` (the old `goto('/search')` behaviour is gone). `topBar` predates the global `layout/navbar` and is **no longer used by the landing page** (the layout navbar replaced it) — retained for reference. |
| `auth/` | hankoAuth, hankoProfile, logoutButton | Hanko web-component wrappers |
| `movies/` | tile, description, image, **detailHeader, factGrid, genderDistribution, collapsibleSection, dddTags**, sectionSkeleton | Movie card, metadata block, responsive poster (optional `imgSizes` prop + `decoding="async"`; `src` defaults to `w500`). The detail-page set (see **Movie detail page**): `detailHeader` (poster + title + meta; renders a **`children` snippet** in the right column — the page passes the metric summary chips + fact grid there, replacing the old plot summary), `factGrid` (definition grid via `lib/movie/format.ts`; **spoken languages dropped**), `genderDistribution` (stacked bar + legend; men use the `--seg-male` token, no blue; `total===0` empty state), **`collapsibleSection`** (native `<details>` card with a chevron, Fraunces title, status pill, optional source link — wraps each metric section), **`dddTags`** (the DDD vote table + single shared fixed tooltip; keyboard-accessible comment triggers). `sectionSkeleton` is a leftover placeholder from the old §3/§4 design — **no longer used** by the rebuilt page. |
| `feedback/` | skeleton | Primitive shimmer block (`width`/`height`/`rounded` props). Animation gated behind `prefers-reduced-motion`; a `static` prop forces a non-animating tint. (Was used by the now-unused `sectionSkeleton`.) |
| `frames/` | metricsFrame | Shell from the old metric-evaluation pages: back nav + "show more/less" toggle. **Orphaned** now that those routes are deleted. |
| `tiles/` | tile, tileGrid, processTileGrid | Generic card; CSS-grid wrappers; sequential checkbox grid w/ progress bar. `processTileGrid` powered the deleted metric-evaluation form — **now orphaned**. |
| `form/` | button, linkButton, checkboxTile, radioTile | Status-variant button, checkbox-as-tile (uses `nanoid` for ids) |
| `search/` | movieSearch, searchInput, searchResults, searchResult, resultPoster (+ `movieSearch.svelte.ts`, `types.ts`); legacy: searchForm | The live inline search, decomposed (see **Live search** below). `movieSearch.svelte` orchestrates a `MovieSearchState` rune class; `searchInput`/`searchResults`/`searchResult`/`resultPoster` are presentational. `searchForm.svelte` is the older standalone form — no longer on the live path. |
| `navigation/` | simple, item | Inline nav bar + items |
| `text/` | block, tooltip | Collapsible HTML block (renders markdown via `{@html}`), tooltip |
| `visualization/` | progressbar | Horizontal/vertical progress bar driven by `current/total` |

Notable mechanics:
- **`themeToggle.svelte`** — runes-based. On mount reads `localStorage.getItem('theme')`, falling back to `window.matchMedia('(prefers-color-scheme: dark)')`. `apply()` sets `document.documentElement.dataset.theme` and persists to localStorage; the button swaps a remixicon sun/moon.
- **`processTileGrid.svelte`** — uses the `setAttributesToChilds` action to number checkboxes, then enforces sequential selection (checking one auto-checks all preceding; unchecking cascades forward), exposing a `reset()` method via `bind:this`. Built for the metric-evaluation form — **now orphaned** (that route was deleted).
- **`collapsibleSection.svelte`** — native `<details>`/`<summary>` disclosure styled as a card: rotating chevron, Fraunces title, a tone-coloured status pill, optional external source link, and a `children` snippet body. Defaults open via an `open` prop; no JS state needed. Used by each metric section on the detail page.
- **`dddTags.svelte`** — the DDD vote table. Renders one **shared** `position: fixed` tooltip for the whole list (not one per row) to avoid CSS hover-gap flicker; commented rows are focusable `<button>`s, the tooltip is positioned from the hovered row's rect, flips above/below by available room, and dismisses on scroll/resize. Honors `prefers-reduced-motion`.
- **`tile.svelte`** — polymorphic via `<svelte:element this={el}>` (renders as `div`, `a`, or `label`).

Stores/actions: `src/lib/stores/debounced.ts` (RxJS `debounceTime`+`distinctUntilChanged`+`switchMap` search store) and `src/lib/actions/setAttributesToChilds.ts`.

---

## Live search (`src/lib/components/search/`)

The landing hero search is a self-contained, inline live-search feature. Backend in **TMDB integration** / `/api/search` above; the front end is decomposed into small pieces around a single rune-class state machine.

- **`movieSearch.svelte.ts`** — the brain. `MovieSearchState` is a **Svelte 5 rune class** (`$state` fields in a `.svelte.ts` module) holding `query`, `results`, `activeIndex`, `loading`, `open`. It owns the debounced store (`createDebouncedSearchStore(fetchResults, 500)`), the keyboard model (`handleKeydown`: Arrow wrap-around, Enter→`select`, Escape→`close`), and navigation (`select` uses `resolve('/movie/[movieId]', …)` — type-safe, satisfies the `svelte/no-navigation-without-resolve` lint). Also exports `optionId(id)` for stable row ids / `aria-activedescendant`.
- **`movieSearch.svelte`** — thin orchestrator: instantiates the state, wires `$effect(() => search.connect())` (RxJS subscription, cleaned up via the returned unsubscribe), the `svelte:window` `pointerdown` click-outside→`close`, and composes the child components. Note the **`.js` import extension** (`./movieSearch.svelte.js`) so Vite resolves the `.svelte.ts` module, not the component.
- **`searchInput.svelte`** — the combobox `<input>` + submit button (presentational). All ARIA wiring (`role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`); swaps the button icon to a spinner while `loading`; exposes `oninput`/`onkeydown`/`onfocus` (focus → `reopen`).
- **`searchResults.svelte`** — the dropdown panel (`role="listbox"`). Three states: rows, a "Searching…" spinner (`loading`), or "No matches". An `$effect` keyed on `activeIndex` calls `scrollIntoView({ block:'nearest' })` to keep the highlighted row visible.
- **`searchResult.svelte`** — one row (`role="option"`): poster + title + a year metadata line + a trailing chevron affordance.
- **`resultPoster.svelte`** — fixed `w92` thumbnail (see TMDB integration note) with an `ri-film-line` placeholder when `posterPath` is null.
- **`types.ts`** — the `SearchResult` shape, shared by client components and the server datasource (single source of truth).

**State/UX rules worth knowing (each one fixed a specific bug):**
- **Open vs. query are separate.** Panel visibility is `open && query.trim()` — `close()` (Esc / click-outside) flips `open=false` but leaves `query`/`results` intact, so the dropdown disappears cleanly instead of stranding a "No matches" panel, and re-focusing the input (`reopen`) re-shows prior results with no refetch.
- **No ghosting between queries.** `search()` clears `results` immediately on a new non-empty query so the previous query's rows don't linger (dimmed) during the debounce window.
- **No chevron trail.** The chevron's transition lives only on `.row.active .chevron` (opacity fade-in, no transform); leaving a row has no exit transition, so a fast highlight sweep never shows two chevrons at once.
- **Motion.** Spinner and chevron both honor `prefers-reduced-motion`.

---

## Configuration & environment

`.env` (gitignored) — required vars:

| Var | Used by | Notes |
|---|---|---|
| `DB_CONNECTION` | `connections.ts` (read via `process.env`) | Postgres URL. Local dev: container on **port 5435** (`postgres://postgres:mysecretpassword@0.0.0.0:5435/midb`). |
| `PUBLIC_HANKO_API_URL` | hooks + auth components | Hanko Cloud tenant URL. |
| `PUBLIC_TMDB_API_URL` | movie + search datasources | `https://api.themoviedb.org` |
| `PUBLIC_TMDB_IMAGE_URL` | image component | `https://image.tmdb.org/t/p` |
| `TMDB_API_TOKEN` | `/api/search` **and** movie-detail `getMovie` (server only) | v4 Read Access Token, sent as `Authorization: Bearer`. Not `PUBLIC_`. **Both** TMDB callers now authenticate with it. |
| `DDD_API_KEY` | `ddd.server.ts` (server only) | Does The Dog Die API key, sent as `X-API-KEY`. Not `PUBLIC_`. Required for the streamed trigger-tags fetch. |

> `EMAIL_*` / `AUTH_SECRET` in `.env` are **unused leftovers** from the dropped Auth.js setup.
> `.npmrc` sets `engine-strict=true`.

### Local run sequence
```bash
docker run --name midb-pg -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=midb -p 5435:5432 -d postgres:16
bun install
bun run db:migrate       # migrations are NOT auto-run
bun run db:seed:movies   # Bechdel CSV → movies spine + movie_bechdel
bun run db:seed:um       # UM CSV → movie_unconsenting (matched by clean_title)
bun run db:backfill:tmdb # optional: resolve tmdb_id ahead of time (else lazy on visit)
bun run dev
```
> The legacy `bun run db:seed` (old metrics seeder) targets dropped tables — don't run it.

### npm scripts
`dev` / `build` / `preview` (Vite) · `check` (svelte-check) · `test` = `test:integration` (Playwright) + `test:unit` (Vitest) · `lint` / `format` (prettier + eslint) · `storybook` / `build-storybook` · `db:generate` (drizzle-kit) · `db:migrate` · **`db:seed:movies`** · **`db:seed:um`** · **`db:backfill:tmdb`** · `db:seed` (legacy).

---

## Known gaps / TODO (as of this snapshot)

1. **`db/schema/metric.ts` is orphaned and must be deleted** — the tables it defines were dropped (migration 0006) and it's no longer imported by `connections.ts`, but drizzle-kit still globs it, so the **next `db:generate` will try to recreate those tables**. Delete the file before generating another migration.
2. **`ddd.spec.ts` is stale** — its mocks use the old `topicId`/`mediaItemComment` field names; the live client now maps from `TopicId`/`comment`. Update the mocks before relying on a green test run.
3. **DDD persistence not built** — `movie_trigger_tags` exists but is **never written**; DDD tags are live-only. This is the explicit next phase (needs the user-interaction layer).
4. **No user/comments layer** — user-submitted evaluations and comments were *removed* (not yet rebuilt); the schema is designed-for it (`movie_trigger_tags.created_by`, retained `user` table) but nothing writes user data. `/user/dashboard` is still just the Hanko profile.
5. **Orphaned UI from the deleted metric routes** — `frames/metricsFrame`, `tiles/processTileGrid`, and `movies/sectionSkeleton` are no longer rendered anywhere; candidates for removal. `landing/topBar` remains orphaned too (superseded by `layout/navbar`).
6. **UM data is sparse by design** — most movies have no `movie_unconsenting` row, so "No data" is the common, correct UM state (not a bug). Title-matching at seed time is lossy; unmatched rows are logged but not reconciled.
7. **No Storybook stories** for the detail-page components (`collapsibleSection`, `dddTags`, `genderDistribution`, `factGrid`, `detailHeader`) — covered by unit tests + manual browser review for now.
8. **`movie.tagline`/`overview` mapped but unused** — the header dropped the plot summary in favour of the metric chips; both fields stay in the `Movie` shape for potential later use.

> Closed in this work: user-evaluation schema removed; movie-detail page rebuilt around seeded multi-source metrics; `getMovie` authenticated + now requests `external_ids` for `imdb_id`; cast/crew has a real `#gender` section.

---

## Related docs
- `.CLAUDE/plans/plan-movie-schema-multi-source.md` — **the plan that drove this snapshot's work** (multi-source schema, seeding strategy, streamed DDD, page redesign). Read it for the design rationale and build-order guidance.
- `.CLAUDE/plans/major-version-upgrade.md` — phased plan that drove the dep upgrades.
- `.CLAUDE/plans/plan-a-landing-page.md`, `.CLAUDE/plans/plan-landing-page-search.md` — landing-page and search design notes.
- `.CLAUDE/plans/plan-movie-detail-sections-1-2.md` — **superseded** — the earlier §1–2 detail-page design (summary + placeholder metric skeletons); kept for history but the page was re-architected since.
- `README.md` (repo root) — original setup notes (contains stale Auth.js-era env vars).
