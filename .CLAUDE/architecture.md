# MIDB — Architecture Reference

> Snapshot as of 2026-06-04 (branch `chore/dependencies-update`). The movie detail page is built around a **multi-source metrics model** — seeded source-of-truth tables (`movie_bechdel`, `movie_unconsenting`) plus a **spine-independent UM catalogue** (`um_source`) and a **live-fetched, streamed** Does-The-Dog-Die client. Each metric is planned to display **two scores side by side**: the original authoritative source and a **MIDB community rating**; movies will also have a **comments section**. The old user-evaluation schema was dropped in migration 0006 but the product direction has pivoted back to community contribution — community rating + comments are the next major feature milestone. Earlier work (landing page + theme toggle, live inline `/api/search`, global nav/footer, Svelte 5 / Vite 8 / Tailwind 4 / Storybook 9 stack) still stands. Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for displaying movies through a **diversity / content-safety lens**. The audience is survivors and trauma-sensitive viewers, and people who care about women's representation — people deciding whether a film is safe to watch. Users find a movie and see how it scores across structured **metrics** — formal tests and content advisories for representation and harm. Three sources are wired today: the **Bechdel Test**, **Unconsenting Media** (sexual-violence advisories), and **Does The Dog Die** (crowd-sourced trigger tags).

Movie facts (poster, overview, release date, credits) are **not stored** — they're fetched live from **TMDB** on each request. What *is* stored locally is a thin movie spine plus **seeded, authoritative metric data** (Bechdel rating, UM advisory flags) and a **spine-independent UM catalogue** (`um_source`) that powers the runtime disambiguation picker. DDD data is fetched live and streamed, not persisted.

Each metric is designed to show **two scores side by side**: the original authoritative source (Bechdel, UM, DDD) and a **MIDB community rating** contributed by users who have watched the film. Movies will also have a **comments section** for viewer context and discussion. Community ratings and comments are the next major feature milestone — the schema will need new tables (community metric scores, comments) and the `/user/*` area will expand beyond the current Hanko profile stub.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2.21 + **Svelte 5** (runes: `$props`/`$state`/`$derived`, snippets; SSR + client hydration) |
| Runtime / package manager | **Bun** (project is "only tested with Bun"; lockfile is JSON `bun.lock`) |
| Build / dev | **Vite 8** (`@sveltejs/adapter-auto` 7) |
| Styling | **Tailwind CSS 4 (CSS-first)** via `@tailwindcss/vite` — no PostCSS config; design tokens live in `src/app.css`. Remixicon for icons. |
| Database | PostgreSQL via **Drizzle ORM** 0.45 (`postgres-js` 3.4 driver) + drizzle-kit 0.31 |
| Auth | **Hanko** (passwordless / passkeys) via `@teamhanko/hanko-elements` 2.6; JWT verified with `jose` 6 |
| External movie data | **TMDB** REST API v3 (Bearer-token auth); **Does The Dog Die** API (live trigger tags, `X-API-KEY`) |
| Seed parsing | **`csv-parse`** 6 (stream-parse the Bechdel + UM source CSVs) |
| Testing | Vitest 4 (unit), Playwright (integration), Storybook 9 (component dev) |
| Lint | ESLint 10 (flat config) + `@typescript-eslint/*` 8 + Prettier |

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
              credits / imdb_id    trigger tags    movies + Bechdel + UM

   Auth:  Browser ⇄ Hanko Cloud (web components + JWT cookie)
          hooks.server.ts verifies the `hanko` cookie via remote JWKS
```

- **Entry point** is the landing page at `/` (hero + search UX). The hero search is a **live, inline TMDB search**: typing queries a server proxy (`/api/search`) and renders a results dropdown in place — there is no `/search` page.
- **Movie identity** flows by **TMDB id** through the URL (`/movie/[movieId]`), but the internal join key across metric sources is **`imdb_id`** (the Bechdel/DDD key). On a detail-page load, the live TMDB movie is resolved to a local `movies` row via `getOrCreateDbMovie` (matching on `tmdb_id` then `imdb_id`, lazily backfilling `tmdb_id`).
- **Metric data** comes from three places: **Bechdel + UM** are seeded into Postgres and rendered server-side (SSR); **DDD** is fetched live from its API and **streamed** so a slow external call never blocks first paint.
- **Auth** is entirely Hanko's; the app only verifies the JWT cookie server-side to gate `/user/*`.

---

## Directory layout

```
MIDB/
├── db/                         # Data layer — lives OUTSIDE src/, aliased as $db/*
│   ├── connections.ts          # Drizzle init + migrateDatabase(); registers ONLY movie + auth schema
│   ├── schema/                 # Drizzle table definitions (drizzle-kit reads ./schema/**/*.ts)
│   │   ├── movie.ts            # movies + movieBechdel + umSource + movieUnconsenting + movieTriggerTags
│   │   └── auth.ts             # user (matches the Hanko-era `user` table)
│   ├── scripts/
│   │   ├── migrate.ts          # `bun run db:migrate` → calls migrateDatabase()
│   │   ├── seed.ts             # legacy metrics seeder — targets dropped tables, do not run
│   │   ├── seedMovies.ts       # `db:seed:movies` — Bechdel CSV → movies spine + movie_bechdel
│   │   ├── seedUnconsenting.ts # `db:seed:um` — UM CSV → um_source (all rows) + movie_unconsenting (matched)
│   │   ├── backfillTmdb.ts     # `db:backfill:tmdb` — fill null tmdb_id via TMDB /find
│   │   └── lib/                # normalizeTitle.ts + stripTrailingYear + checkCsvColumns.ts
│   ├── seeds/
│   │   ├── sources/            # raw CSVs: bechdel.csv, unconsenting.csv, unconsenting_unmatched.txt (report)
│   │   └── prod/metrics/       # legacy metric seed (bechdel.yml) for the old seed.ts
│   └── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots
│
├── src/
│   ├── hooks.server.ts         # Auth gate: verifies `hanko` JWT cookie, protects /user/*
│   ├── app.css                 # Tailwind v4 entry + design tokens + @layer components
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── routes/                 # File-based routing (see below)
│   │   └── +layout.svelte      # Root shell: app.css + remixicon, global Navbar + <main> + Footer
│   └── lib/
│       ├── components/         # Reusable UI, grouped by domain
│       ├── movie/              # Client-safe pure helpers: format.ts (Intl) + metrics.ts (BECHDEL_TIERS / UM_FLAGS / UmCandidate)
│       ├── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│       └── stores/             # debounced.ts
│
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, dialect/credentials)
├── svelte.config.js            # adapter-auto; alias $db/* → ./db/*; vitePreprocess({ style:false })
├── vite.config.ts              # tailwindcss() + sveltekit() + svelteTesting() + Vitest block
└── .env                        # DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN, DDD_API_KEY
```

**Key structural choice:** the database layer (`db/`) sits *outside* `src/`, exposed to the app via the `$db/*` alias defined in `svelte.config.js`. Server-only route modules import `db` from `$db/connections`.

---

## Styling & theming

The styling system is **Tailwind CSS v4, CSS-first**. There is no JS theme config in the build path — the source of truth is `src/app.css`.

- **Entry & tokens.** `app.css` begins with `@import "tailwindcss"`. Build-time design tokens are declared in a `@theme { … }` block. Semantic *colors* are exposed through **`@theme inline { --color-*: var(--*) }`** so utilities re-resolve at render time and a theme switch re-cascades without rebuilding.
- **Design-token system.** Raw palette ramps (`--rv-*` purple, `--aq-*` aqua) plus semantic tokens: `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--brand`, `--brand-strong`, `--accent`, `--accent-bg`, `--accent-ink`, `--border`, plus status tokens `--success`/`--warn`/`--danger`/`--info`, each with `-soft` (hover/muted) and `-fg` (on-color text) variants. `--font-display` (Fraunces). `--seg-male` (lilac light / gold dark) for the gender chart's men segment.
- **Three theming layers** in cascade order: `:root` (light defaults) → `@media (prefers-color-scheme: dark) :root:not([data-theme])` (system dark, only when no manual override) → `:root[data-theme="light|dark"]` (manual override via the theme toggle, written to `document.documentElement.dataset.theme`).
- **`tailwind.config.js`** is a vestigial Tailwind-v3 leftover — not read for theming under v4. Do not treat it as the active source of truth.
- **Svelte `<style>` blocks** use `<style lang="postcss">` with `@reference "…/app.css"` so `@apply` resolves v4 tokens. `vitePreprocess({ style: false })` prevents vitePreprocess from running its own PostCSS pass.

---

## Routes

| Route | Files | Status | Notes |
|---|---|---|---|
| `/` | `+page.svelte`, `+page.server.ts` | **Working** | Landing: italic brand eyebrow, large serif headline, one-sentence subhead, `HeroSearch` (live inline search), "Rate a film yourself →" CTA to `/auth`, 3-up metrics band (Bechdel / UM / DDD, one sentence each), closing note on the dual-source model. `+page.server.ts` returns `{}`. `heroSearch.svelte` applies landing-specific sizing and a 2px brand focus ring to the search box. |
| `/api/search` | `+server.ts`, `datasource.server.ts` | **Working** | `GET ?q=…` proxy to TMDB `search/movie`. Empty/whitespace `q` short-circuits to `{ results: [] }`. Returns slim `SearchResult[]`. No `/search` page exists. |
| `/auth` | `+page.svelte`, `+page.ts`, `+layout.svelte` | Working | Renders Hanko `<hanko-auth>`. On success redirects to `/user/dashboard`. `ssr=false`. |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts`, `db.server.ts`, `ddd.server.ts`, `types.ts` | **Working** | Core page — see **Movie detail page** below. |
| `/user/dashboard` | `+page.svelte`, `+page.ts` | Working (minimal) | Hanko `<hanko-profile>`. Auth-gated by `hooks.server.ts`. `ssr=false`. |

> **Removed routes:** `/movie/[movieId]/metric` and `/movie/[movieId]/metric/[metricId]` (user-driven evaluation forms) were deleted when the app moved from user-submitted evaluations to seeded source data.

---

## Database schema

The **active schema is entirely in `db/schema/movie.ts`** (+ `auth.ts` for `user`). `connections.ts` registers only `movieSchema` + `authSchema`.

> The old user-evaluation model (`metrics`, `metric_options`, `evaluations`, `evaluation_results`) was **dropped in migration 0006**. `db/schema/metric.ts` has been **deleted** — it is no longer on disk.

### Tables (active)

**`movies`** — the spine; seeded from the Bechdel CSV, enriched lazily from TMDB.
- `id` uuid PK, `imdb_id` varchar **unique NOT NULL** (cross-source join key), `tmdb_id` integer **unique nullable** (backfilled lazily), `title` varchar(255), `year` integer, `clean_title` varchar(255) (output of `normalizeTitle()` — the UM match key), `created_at`, `updated_at`.
- `clean_title` is computed via `normalizeTitle(movie.title)` in `getOrCreateDbMovie` (Bug B fixed: previously used bare `.toLowerCase().trim()` which left quote chars from TMDB titles unnormalized).

**`movie_bechdel`** — seeded, **1:1 with movie**.
- `movie_id` uuid **PK** → `movies.id` (cascade), `bechdel_id` integer, `rating` smallint (**CHECK 0..3**), `num_votes` integer, `created_at`.

**`um_source`** — spine-independent **UM catalogue**; every movie-type UM row from the CSV.
- `um_id` integer **PK**, `clean_name` varchar, `clean_title_key` varchar (year-stripped normalized key, the lookup index), `year` integer nullable, all **9 boolean flag columns**, `comment` text.
- Populated by `db:seed:um` for **all** UM movie rows regardless of whether a `movies` row exists. Enables runtime candidate lookup without re-parsing the CSV.

**`movie_unconsenting`** — seeded, **1:1 with movie**; the resolved UM binding.
- `movie_id` uuid **PK** → `movies.id` (cascade), `um_id` integer, `clean_name` varchar, `item_type` varchar, `comment` text, all **9 boolean flag columns**, `created_at`.
- Matched by `clean_title` at seed time using a year-aware policy (see Seeding). No `match_source` column — user choices are never persisted (see UM Disambiguation below).

**`movie_trigger_tags`** — DDD, **defined now, NOT written yet**.
- `id` serial PK, `movie_id` uuid, `topic_id` integer, `does_name` varchar, `yes_sum`/`no_sum` integer, `comment` text, `created_by` text → `user.id` (future), `created_at`. Unique index on (`movie_id`, `topic_id`). DDD tags are live-only today.

**`user`** (`auth.ts`) — `id` text PK, `name`, `email`, `emailVerified`, `image`. Carried over from the Auth.js era; retained for Hanko + the future `movie_trigger_tags.created_by` FK.

### Migrations

Chain: `0000` (movies) → `0001` (Auth.js tables) → `0002` (metrics/options/evaluations) → `0003` (Bechdel seed) → `0004` (rename + NOT NULL) → `0005` (breakpoints) → **`0006_panoramic_vivisector`** (creates `movie_bechdel` / `movie_unconsenting` / `movie_trigger_tags`, extends `movies`, drops evaluation tables) → **`0007_um_source_and_match_source`** (creates `um_source`, originally added `match_source` to `movie_unconsenting`) → **`0008_drop_match_source`** (drops `match_source` — user-confirmed persistence was removed in favour of client-side-only disambiguation).

Migrations **do NOT auto-run** — run `bun run db:migrate` explicitly. `drizzle-kit` is run manually; `db:generate` can no longer conflict with the orphaned `metric.ts` (it has been deleted).

---

## Seeding

Raw CSVs in `db/seeds/sources/`. Scripts run under Bun, use `csv-parse` for streaming, and import `db` from `$db/connections`. All upserts are idempotent (`onConflictDoUpdate`).

1. **`db:seed:movies`** (`seedMovies.ts`) — stream the **Bechdel CSV** → upsert `movies` (spine) + `movie_bechdel`. Source of `imdb_id`, `title`, `year`, `clean_title`.
2. **`db:seed:um`** (`seedUnconsenting.ts`) — stream the **UM CSV**:
   - Populates **`um_source`** for every movie-type row (idempotent, regardless of match outcome).
   - Derives a `(titleKey, umYear)` pair per row using **`stripTrailingYear`** (UM's `cleanNameArticles` often embeds the year: `"wuthering heights 2026"`).
   - Matches to `movies` by **year-aware policy**: (1) exact `(titleKey, umYear)` → bind; (2) only one movie with this title → bind (unambiguous); (3) multiple same-title movies, no year hit → leave unmatched (`ambiguous` in report). Unmatched rows logged to `unconsenting_unmatched.txt`.
   - Does **not** create `movies` rows from UM data.
3. **`db:backfill:tmdb`** (`backfillTmdb.ts`) — resolve null `tmdb_id` via TMDB `/find/{imdb_id}`. Also done lazily by `getOrCreateDbMovie` on first page visit.

**`db/scripts/lib/normalizeTitle.ts`** — two exports:
- `normalizeTitle(title)` — lowercase, strip leading articles (en/fr/de/es/it), strip diacritics + punctuation, collapse whitespace. Must mirror UM's `cleanName` conventions.
- `stripTrailingYear(normalized)` — removes a trailing ` (19|20)\d\d` from an already-normalized string, returns `{ key, year }`. Used to handle the ~12% of UM rows whose `cleanNameArticles` embeds the year.

Both are covered by unit specs (`src/lib/normalizeTitle.spec.ts`).

Run order matters: **`db:seed:movies` must run before `db:seed:um`** so the `movies` spine is populated before UM tries to bind to it. Re-running either is safe.

---

## Movie detail page (`src/routes/movie/[movieId]/`)

The flagship page. Server-rendered for DB metrics, **streamed** for the live DDD call.

**Server (`+page.server.ts`):**
```ts
const movie = await getMovie(params.movieId);          // TMDB live (Bearer, credits+external_ids)
const dbMovie = await getOrCreateDbMovie(movie);        // resolve/create movies row
const [bechdel, unconsenting] = await Promise.all([     // DB, fast → in SSR HTML
  getBechdel(dbMovie.id), getUnconsenting(dbMovie.id),
]);
// No seeded UM binding → look up um_source candidates for runtime disambiguation
const umCandidates = unconsenting === null ? await getUnconsentingCandidates(movie) : [];
return { movie, bechdel, unconsenting, umCandidates,
         triggerTags: getTriggerTagsLive(movie.imdbId) };  // UN-awaited → streamed
```

**DDD live client (`ddd.server.ts`):** two-step fetch with `X-API-KEY`; 1h in-memory `Map` cache keyed by `imdb_id`. Returns `TriggerTag[]` filtered to `yesSum >= noSum && yesSum > 0`.

**Page (`+page.svelte`) — rendered structure:**
- **`#details` header** (`detailHeader.svelte`): poster + title + year/runtime meta + **metric summary chips** + **fact grid**.
- **Metric summary chips** — three anchor links (`#bechdel`/`#unconsenting`/`#ddd`). The UM chip shows an **`--accent-bg` (teal) pulsing badge** when candidates are available for disambiguation. Chip reads from `umData` (see UM Disambiguation).
- **Three collapsible metric sections** (`collapsibleSection.svelte`, native `<details>`): each with a status pill, defaults open when it has data. The UM section also opens when candidates exist.
- **`#gender` section** — plain `<section>` outside the collapsible stack: `genderDistribution.svelte` stacked bar + legend. Men use `--seg-male` (lilac light / gold dark).

**`db.server.ts`** — the detail page's DB module:
- `getOrCreateDbMovie(movie)` — tries `tmdb_id` → `imdb_id` → insert, backfilling the missing id. Uses `normalizeTitle()` for `clean_title` on insert.
- `getBechdel(movieId)` / `getUnconsenting(movieId)` — simple `findFirst ?? null`.
- `getUnconsentingCandidates(movie)` — queries `um_source` by `cleanTitleKey`; applies year-aware filtering (see UM Disambiguation); returns full flag data so a picked candidate renders identically to a seeded row.

---

## UM Disambiguation

UM is the only source with no `imdb_id`, matched purely by normalized title. When a movie has no seeded `movie_unconsenting` binding, `getUnconsentingCandidates` resolves candidates from `um_source`:

| Movie year known? | Candidates | Outcome |
|---|---|---|
| Yes | Exact year match found | Return that one candidate → **rendered directly, no picker** (auto-match) |
| Yes | No candidate shares the year | Return `[]` → **"No data"** (film isn't in UM; don't offer mismatched-year data) |
| Unknown (0 / no `releaseDate`) | Any | Return all candidates → **picker shown** |

**Nothing is persisted.** A user's pick lives only for the current page view — `selectedUm` is a `$state` variable, reset whenever `movie.id` changes. The page derives `umData = unconsenting ?? autoUm ?? selectedUm`; the chip, section header, and flag list all read from `umData` so a picked candidate renders identically to a seeded binding.

**Why `um_source` exists:** `movie_unconsenting` is a binding — keyed by `movie_id`, it can only hold entries that *already matched* a spine movie. For ambiguous (same title, different year) or spine-absent films, `um_source` is the durable, re-queryable catalogue that doesn't require re-parsing the 55k-row CSV per request.

**`UmCandidate` type** (in `src/lib/movie/metrics.ts`) — carries `umId`, `cleanName`, `year`, `flagCount` (concern count, excluding `noRape`) + all 9 flag booleans + `comment`, making it union-compatible with `UnconsentingData` for the shared rendering path.

---

## UM flag rendering

`UM_FLAGS` defines 9 flags. `noRape` is **inverted** — `true` means *no rape or sexual assault* (a reassurance, not a concern). It is treated specially throughout:
- **Concern count** (`umFlagCount`, picker's `flagCount`) excludes `noRape`. The chip/status reads "0 concerns" when only `noRape` is true.
- **Flag list** — `noRape === true` renders with `.um-flag--reassurance`: `ri-checkbox-circle-fill` icon in `--success` green (matching the Bechdel-tier green), never the amber warning treatment.
- All other flags: present (`true`) → `.um-flag--present` with `ri-alert-fill` in `--warn`; absent → muted circle.

---

## Component library (`src/lib/components/`)

| Group | Components | Notes |
|---|---|---|
| `theme/` | themeToggle | Light/dark switch; reads localStorage, writes `document.documentElement.dataset.theme` |
| `layout/` | navbar, footer | Global chrome, mounted in root `+layout.svelte` |
| `landing/` | topBar, heroSearch | `heroSearch` wraps `search/movieSearch`. `topBar` is **orphaned** (superseded by `layout/navbar`) |
| `auth/` | hankoAuth, hankoProfile, logoutButton | Hanko web-component wrappers |
| `movies/` | tile, description, image, detailHeader, factGrid, genderDistribution, collapsibleSection, dddTags, **umCandidates**, sectionSkeleton | `umCandidates.svelte` — the UM disambiguation picker: `role="list"` of candidate rows (UM glyph + title + year + flag-count pill); each row is a `<button>` that fires an `onselect(candidate)` callback → sets `selectedUm` in the page, no network call. `sectionSkeleton` is **orphaned** (no longer rendered). |
| `feedback/` | skeleton | Shimmer block. Used by `sectionSkeleton` which is itself orphaned. |
| `frames/` | metricsFrame | **Orphaned** — powered the deleted metric-evaluation routes. |
| `tiles/` | tile, tileGrid, processTileGrid | `processTileGrid` powered the deleted evaluation form — **orphaned**. |
| `form/` | button, linkButton, checkboxTile, radioTile | Status-variant button, tile-form controls |
| `search/` | movieSearch, searchInput, searchResults, searchResult, resultPoster (+ `movieSearch.svelte.ts`, `types.ts`) | Live inline search (see Live search below) |
| `navigation/` | simple, item | Inline nav |
| `text/` | block, tooltip | Collapsible HTML block, tooltip |
| `visualization/` | progressbar | Horizontal/vertical progress bar |

Notable mechanics:
- **`collapsibleSection.svelte`** — native `<details>`/`<summary>` card: rotating chevron, Fraunces title, tone-coloured status pill, optional source link, `children` snippet body.
- **`dddTags.svelte`** — DDD vote table. One **shared** `position: fixed` tooltip for the whole list (avoids per-row CSS hover-gap flicker). Rows with a comment are focusable `<button>`s; tooltip is positioned from the hovered row's rect, flips above/below by available room, dismisses on scroll/resize. Header row (`ddd-header`) labels the Yes/No vote columns in muted `--danger-soft`/`--success-soft` colors. Honors `prefers-reduced-motion`.
- **`genderDistribution.svelte`** — stacked bar + legend; `total===0` empty state; men use `--seg-male`.

---

## Live search (`src/lib/components/search/`)

- **`movieSearch.svelte.ts`** — `MovieSearchState` rune class: `query`, `results`, `activeIndex`, `loading`, `open`. Owns the debounced RxJS store (500ms), keyboard model (Arrow wrap-around, Enter→select, Escape→close), and navigation (`resolve('/movie/[movieId]', …)`).
- **`movieSearch.svelte`** — orchestrator: instantiates state, wires `$effect(() => search.connect())`, click-outside dismiss, composes child components. Import uses **`.js` extension** (`./movieSearch.svelte.js`) so Vite resolves the `.svelte.ts` module, not the component.
- Panel visibility is `open && query.trim()` — `close()` flips `open` but preserves `query`/`results` so re-focus re-shows prior results without refetch.

---

## TMDB integration

- **`datasource.server.ts`** (`movie/[movieId]/`) — `getMovie(id)` fetches `append_to_response=credits,external_ids`, maps to `Movie` (including `imdbId` from `external_ids`), aggregates cast/crew gender server-side.
- **`datasource.server.ts`** (`api/search/`) — `searchMovies(q)` → TMDB `search/movie`. Shared `SearchResult` type with client components via `$lib/components/search/types`.
- **`image.svelte`** — responsive `srcset` from `PUBLIC_TMDB_IMAGE_URL`; `src` defaults to `w500`. `resultPoster.svelte` builds a fixed `w92` URL directly (keeps the 20-row search list cheap).

---

## Auth flow (Hanko)

1. `/auth` renders `<hanko-auth>` → success event → `goto("/user/dashboard")`.
2. Hanko sets a `hanko` JWT cookie.
3. `hooks.server.ts` verifies it via remote JWKS (`jose`); any `/user/*` with invalid/absent token → `redirect(303, "/auth")`.
4. `/user/dashboard` renders `<hanko-profile>`.
5. `logoutButton.svelte` calls the Hanko client's logout then redirects.

---

## Configuration & environment

| Var | Used by | Notes |
|---|---|---|
| `DB_CONNECTION` | `connections.ts` | Postgres URL. Local dev: `postgres://postgres:mysecretpassword@0.0.0.0:5435/midb` |
| `PUBLIC_HANKO_API_URL` | hooks + auth components | Hanko Cloud tenant URL |
| `PUBLIC_TMDB_API_URL` | movie + search datasources | `https://api.themoviedb.org` |
| `PUBLIC_TMDB_IMAGE_URL` | image component | `https://image.tmdb.org/t/p` |
| `TMDB_API_TOKEN` | movie-detail + search (server only) | v4 Bearer token. `$env/static/private`. |
| `DDD_API_KEY` | `ddd.server.ts` (server only) | Does The Dog Die API key, `X-API-KEY` header. |

### Local run sequence
```bash
docker run --name midb-pg -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=midb -p 5435:5432 -d postgres:16
bun install
bun run db:migrate
bun run db:seed:movies   # must run before db:seed:um
bun run db:seed:um
bun run db:backfill:tmdb # optional: resolve tmdb_id ahead of time
bun run dev
```
> Do not run `bun run db:seed` — the legacy metrics seeder targets dropped tables.

### npm scripts
`dev` / `build` / `preview` · `check` · `test` = `test:integration` + `test:unit` · `lint` / `format` · `storybook` / `build-storybook` · `db:generate` · `db:migrate` · `db:seed:movies` · `db:seed:um` · `db:backfill:tmdb` · `db:seed` (legacy, dead).

---

## Known gaps / TODO

1. **`ddd.spec.ts` is stale** — its mocks use the old `topicId`/`mediaItemComment` field names; the live client maps from `TopicId`/`comment`. Update before relying on a green test run.
2. **DDD persistence not built** — `movie_trigger_tags` exists but is never written; DDD tags are live-only. Deferred to a future user-interaction phase.
3. **Community ratings + comments not yet built** — the next major milestone. Each metric will show the original source score alongside a MIDB community score; movies will also have a comments section. Schema will need new tables (community metric scores keyed by `movie_id` + metric + `user_id`, and a `comments` table). The retained `user` table and `movie_trigger_tags.created_by` FK are the hooks. `/user/dashboard` is currently the Hanko profile only and will need to expand.
4. **Orphaned UI** — `frames/metricsFrame`, `tiles/processTileGrid`, `movies/sectionSkeleton`, and `landing/topBar` are no longer rendered anywhere; candidates for removal.
5. **UM data is sparse by design** — ~2,981 of ~9,471 spine movies have a UM binding. "No data" is the common, correct state. ~34 title collisions are left as runtime-picker cases (year unknown); ~7,481 have no UM entry at all.
6. **No Storybook stories** for detail-page components (`collapsibleSection`, `dddTags`, `genderDistribution`, `factGrid`, `detailHeader`, `umCandidates`).
7. **`movie.tagline`/`overview` mapped but unused** — the header dropped the plot summary in favour of metric chips; both fields stay in the `Movie` shape for potential later use.
8. **`db:generate` requires a TTY** — drizzle-kit's interactive conflict-resolution prompts require a real terminal. Migrations have been written manually for schema changes made in this session; run `db:generate` from the terminal, not from a CI/non-interactive shell.

---

## Related docs
- `.CLAUDE/plans/plan-um-matching-fix.md` — the plan that drove the UM matching overhaul (year-aware seeder, `um_source` table, runtime disambiguation picker, `noRape` inversion). Implemented and closed.
- `.CLAUDE/plans/plan-movie-schema-multi-source.md` — the plan that drove the multi-source schema (Bechdel + UM seeding, streamed DDD, page redesign).
- `.CLAUDE/plans/major-version-upgrade.md` — phased dep-upgrade plan.
- `.CLAUDE/plans/plan-a-landing-page.md`, `.CLAUDE/plans/plan-landing-page-search.md` — landing-page and search design notes.
- `.CLAUDE/plans/plan-movie-detail-sections-1-2.md` — **superseded** earlier §1–2 detail-page design; kept for history.
- `README.md` (repo root) — original setup notes (contains stale Auth.js-era env vars).
