# MIDB — Architecture Reference

> Snapshot as of 2026-06-08 (branch `main`). The detail pages are built around a **multi-source metrics model** — seeded source-of-truth tables (`movie_bechdel`, `movie_unconsenting`) plus a **spine-independent UM catalogue** (`um_source`) and a **live-fetched, streamed** Does-The-Dog-Die client. Both **movies and TV series** are supported (`/movie/[movieId]`, `/tv/[seriesId]`). Each metric is planned to display **two scores side by side**: the original authoritative source and a **MIDB community rating**; titles will also have a **comments section**. The old user-evaluation schema was removed (and the migrations later squashed to a clean `0000` baseline) but the product direction has pivoted back to community contribution — community rating + comments are the next major feature milestone. Earlier work (landing page + theme toggle, live inline `/api/search`, global nav/footer, Svelte 5 / Vite 8 / Tailwind 4 / Storybook 9 stack) still stands.
>
> **The `src/lib` tree was reorganised by domain + file-type** (see Directory layout + File-organisation conventions): shared server logic moved out of route folders into `$lib/server/{data,integrations}`, shared types/utils into `$lib/media/{types,utils}`, and components split into `$lib/components/ui/*` (generic primitives) vs domain folders. Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for displaying movies and TV series through a **diversity / content-safety lens**. The audience is survivors and trauma-sensitive viewers, and people who care about women's representation — people deciding whether a title is safe to watch. Users find a title and see how it scores across structured **metrics** — formal tests and content advisories for representation and harm. Three sources are wired today: the **Bechdel Test**, **Unconsenting Media** (sexual-violence advisories), and **Does The Dog Die** (crowd-sourced trigger tags).

Title facts (poster, overview, release/air date, credits, seasons) are **not stored** — they're fetched live from **TMDB** on each request. What _is_ stored locally is a thin spine (the `movies` table holds both films and series) plus **seeded, authoritative metric data** (Bechdel rating, UM advisory flags) and a **spine-independent UM catalogue** (`um_source`) that powers the runtime disambiguation picker. DDD data is fetched live and streamed, not persisted.

Each metric is designed to show **two scores side by side**: the original authoritative source (Bechdel, UM, DDD) and a **MIDB community rating** contributed by users who have watched the film. Movies will also have a **comments section** for viewer context and discussion. Community ratings and comments are the next major feature milestone — the schema will need new tables (community metric scores, comments) and the `/user/*` area will expand beyond the current Hanko profile stub.

---

## Tech stack

| Layer                     | Technology                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                 | SvelteKit 2.21 + **Svelte 5** (runes: `$props`/`$state`/`$derived`, snippets; SSR + client hydration)                                                                   |
| Runtime / package manager | **Bun** (project is "only tested with Bun"; lockfile is JSON `bun.lock`)                                                                                                |
| Build / dev               | **Vite 8** (`@sveltejs/adapter-auto` 7)                                                                                                                                 |
| Styling                   | **Tailwind CSS 4 (CSS-first)** via `@tailwindcss/vite` — no PostCSS config; design tokens live in `src/app.css`. Remixicon for icons.                                   |
| Database                  | PostgreSQL via **Drizzle ORM** 0.45 (`postgres-js` 3.4 driver) + drizzle-kit 0.31                                                                                       |
| Auth                      | **Hanko** (passwordless / passkeys) via `@teamhanko/hanko-elements` 2.6; JWT verified with `jose` 6                                                                     |
| External movie data       | **TMDB** REST API v3 (Bearer-token auth); **Does The Dog Die** API (live trigger tags, `X-API-KEY`)                                                                     |
| Server cache              | Swappable backend (`$lib/server/cache`): bounded in-memory LRU by default; **Redis** (optional, lazy `redis` pkg) when `REDIS_URL` is set. Caches TMDB + DDD responses. |
| Seed parsing              | **`csv-parse`** 6 (stream-parse the Bechdel + UM source CSVs)                                                                                                           |
| Testing                   | Vitest 4 (unit, co-located in `__tests__/`), Playwright (integration, in `e2e-tests/`), Storybook 9 (component dev)                                                     |
| Lint                      | ESLint 10 (flat config) + `@typescript-eslint/*` 8 + Prettier                                                                                                           |

---

## High-level data flow

```
                  ┌────────────────────────────────────────────┐
   Browser  ──►   │  SvelteKit server (hooks + load functions)  │
                  └──────┬──────────────┬──────────────┬────────┘
                         │ (via $lib/server/cache: in-mem LRU │
                         │  default, Redis if REDIS_URL set)  │
            cached fetch┌─▼────────┐ ┌───▼──────┐ ┌─────▼───────┐
                        │  TMDB    │ │   DDD    │ │  PostgreSQL │
                        │  API v3  │ │   API    │ │  (Drizzle)  │
                        └──────────┘ └──────────┘ └─────────────┘
                         ▲            ▲ (streamed,   ▲
              poster / overview /     │  cached 1h)  │  seeded source data:
              credits / imdb_id    trigger tags    movies + Bechdel + UM
              (cached 24h)

   Auth:  Browser ⇄ Hanko Cloud (web components + JWT cookie)
          hooks.server.ts verifies the `hanko` cookie via remote JWKS
   Startup: hooks.server.ts runs migrateDatabase() once at server boot
```

- **Entry point** is the landing page at `/` (hero + search UX). The hero search is a **live, inline TMDB search**: typing queries a server proxy (`/api/search`, TMDB `search/multi`) and renders a results dropdown in place — there is no `/search` page. Results carry a `mediaType` (`movie`/`tv`) and route to the matching detail page.
- **Title identity** flows by **TMDB id** through the URL (`/movie/[movieId]`, `/tv/[seriesId]`), but the internal join key across metric sources is **`imdb_id`** (the Bechdel/DDD key). On a detail-page load the live TMDB title is resolved to a local `movies` row via **read-only** `getDbMovie`/`getDbMedia` (matching on `tmdb_id` then `imdb_id`); a GET never mutates the DB. TV rows use a synthetic `tmdb-tv:` imdb namespace + null `tmdb_id` to avoid colliding with film tmdb ids.
- **Metric data** comes from three places: **Bechdel + UM** are seeded into Postgres and rendered server-side (SSR); **DDD** is fetched live from its API and **streamed** so a slow external call never blocks first paint. (Bechdel is movie-only; series surface UM + DDD.)
- **Caching.** TMDB title fetches (`getMovie`/`getSeries`) and DDD lookups go through `$lib/server/cache` so repeat visits to a title skip the external round-trip — the dominant source of detail-page latency. Default backend is a bounded in-process LRU (fine on a long-lived Node server); set `REDIS_URL` for a shared backend that survives restarts / scales across instances. Detail loads also set `cache-control: public, max-age=0, s-maxage=3600` so the browser/back-forward cache and any CDN can serve repeat navigations.
- **Auth** is entirely Hanko's; the app only verifies the JWT cookie server-side to gate `/user/*`.

---

## Directory layout

```
MIDB/
├── db/                         # Data layer — lives OUTSIDE src/, aliased as $db/*
│   ├── connections.ts          # Drizzle init + migrateDatabase(); registers movie + auth + community schema
│   ├── schema/                 # Drizzle table definitions (drizzle-kit reads ./schema/**/*.ts)
│   │   ├── movie.ts            # movies + movieBechdel + umSource + movieUnconsenting + movieTriggerTags
│   │   ├── auth.ts             # user (Hanko-sub PK, role enum, username/avatarKey, lower(username) idx)
│   │   └── community.ts        # communityMetricSubmissions + comments (empty, indexes ready)
│   ├── scripts/
│   │   ├── migrate.ts          # `bun run db:migrate` → calls migrateDatabase()
│   │   ├── seedMovies.ts       # `db:seed:movies` — Bechdel CSV → movies spine + movie_bechdel
│   │   ├── seedUnconsenting.ts # `db:seed:um` — UM CSV → um_source (all rows) + movie_unconsenting (matched)
│   │   ├── seedAdmin.ts        # `db:seed:admin <email>` — case-insensitive promote to administrator
│   │   ├── backfillTmdb.ts     # `db:backfill:tmdb` — fill null tmdb_id via TMDB /find
│   │   └── lib/                # normalizeTitle.ts + stripTrailingYear + checkCsvColumns.ts
│   ├── seeds/
│   │   └── sources/            # raw CSVs: bechdel.csv, unconsenting.csv, unconsenting_unmatched.txt (report)
│   └── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots
│
├── src/
│   ├── hooks.server.ts         # Auth gate: module-level JWKS, verifies `hanko` JWT, JIT-provisions user row, populates locals.user, protects /user/*
│   ├── app.css                 # Tailwind v4 entry + design tokens + @layer components
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── __tests__/              # index.test.ts (smoke)
│   ├── routes/                 # File-based routing (see below). Route folders hold ONLY
│   │   │                       #   +page/+server/datasource — shared logic lives in $lib.
│   │   ├── +layout.svelte      # Root shell: app.css + remixicon, global Navbar + <main> + Footer
│   │   └── +error.svelte       # Error boundary (404 + fallback), rendered inside the shell's <main>
│   └── lib/
│       ├── server/             # SvelteKit-ENFORCED server-only boundary (no client import)
│       │   ├── data/           # Postgres / Drizzle access (+ __tests__/)
│       │   │   ├── media-queries.ts  # identity resolution (getDbMovie/getDbMedia/getOrCreate*) + metric fetches (getBechdel/getUnconsenting)
│       │   │   ├── um-candidates.ts  # UM disambiguation algo: getUnconsentingCandidates + toCandidate helper
│       │   │   └── user-queries.ts   # JIT provision + profile update (validated) + username availability + history queries
│       │   ├── integrations/   # External API clients (hold secrets) (+ __tests__/)
│       │   │   ├── tmdb.ts           # shared TMDB client + aggregateGender
│       │   │   ├── ddd.ts            # DDD client; uses $lib/server/cache; re-exports TriggerTag/DddResult from ddd-types
│       │   │   └── ddd-types.ts      # public domain types: TriggerTag, DddResult (no client import of secrets)
│       │   └── cache/          # getCached(key, ttlMs, fetcher): in-memory LRU default, Redis if REDIS_URL set
│       ├── media/              # Shared, client-safe media domain (movies + series)
│       │   ├── types/          # media.ts (MediaDetail/GenderBreakdown), movie.ts, series.ts,
│       │   │                   #   ddd.ts (type-only re-export from integrations/ddd-types),
│       │   │                   #   user.ts (type-only UserRole re-export from server/data/user-queries)
│       │   └── utils/          # format.ts (Intl), metrics.ts (BECHDEL_TIERS/UM_FLAGS/UmCandidate/dddUrl/umFlagCount),
│       │                       #   dddStream.svelte.ts (createDddState rune factory) (+ __tests__/)
│       ├── components/         # Reusable UI: ui/* primitives + domain folders (see Component library)
│       ├── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│       └── stores/             # debounced.ts
│
├── e2e-tests/                  # Playwright integration tests (testDir; renamed from tests/)
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, dialect/credentials)
├── playwright.config.ts        # testDir: 'e2e-tests'
├── svelte.config.js            # adapter-auto; alias $db/* → ./db/*; vitePreprocess({ style:false })
├── vite.config.ts              # tailwindcss() + sveltekit() + svelteTesting() + Vitest block
└── .env                        # DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN, DDD_API_KEY, REDIS_URL (optional)
```

**Key structural choices:**

- The database layer (`db/`) sits _outside_ `src/`, exposed via the `$db/*` alias in `svelte.config.js`. Server-only modules import `db` from `$db/connections`.
- **Shared server logic does not live inside route folders.** Anything two routes both need (DB queries, external API clients) lives under `$lib/server/`; route folders keep only their route files plus a route-specific `datasource.server.ts`.

### File-organisation conventions

- **`$lib/server/**` is the server-only boundary.** SvelteKit fails the build if any client-reachable code imports from it. Secrets (`TMDB_API_TOKEN`, `DDD_API_KEY`) and DB access live here only. `data/`= Postgres;`integrations/` = external HTTP clients.
- **Components for types, never routes.** A component that needs a `Movie`/`Series`/`TriggerTag` type imports it from `$lib/media/types/*` — `media/types/ddd.ts` re-exports DDD types from `integrations/ddd-types.ts` (not `ddd.ts`) as **types only** (erased at build, so no server runtime leaks into the client bundle). Components no longer reach back into `routes/.../`.
- **`ui/` vs domain.** Generic, reusable primitives (button, tile, skeleton, tooltip, progressbar) live in `$lib/components/ui/*`; title-specific UI lives in domain folders (`movies/*`, `search/*`, …).
- **Imports use `$lib`/`$db` aliases**, with relative `./` reserved for same-folder siblings.
- **Tests are co-located in a `__tests__/` subfolder** at each location (vitest glob `src/**/*.{spec,test}.{js,ts}` matches any depth). Playwright e2e specs live in top-level `e2e-tests/`.

---

## Styling & theming

The styling system is **Tailwind CSS v4, CSS-first**. There is no JS theme config in the build path — the source of truth is `src/app.css`.

- **Entry & tokens.** `app.css` begins with `@import "tailwindcss"`. Build-time design tokens are declared in a `@theme { … }` block. Semantic _colors_ are exposed through **`@theme inline { --color-*: var(--*) }`** so utilities re-resolve at render time and a theme switch re-cascades without rebuilding.
- **Design-token system.** Raw palette ramps (`--rv-*` purple, `--aq-*` aqua) plus semantic tokens: `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--brand`, `--brand-strong`, `--accent`, `--accent-bg`, `--accent-ink`, `--border`, plus status tokens `--success`/`--warn`/`--danger`/`--info`, each with `-soft` (hover/muted) and `-fg` (on-color text) variants. `--font-display` (**Newsreader** — high-contrast old-style serif with optical sizing + true italics, used for the wordmark/titles/eyebrow via the `.display` class) and `--font-body` (**Hanken Grotesk** — neutral humanist sans, wired to Tailwind's `--font-sans` so it's the default body face). Both loaded from Google Fonts in `app.html`. `--seg-male` (lilac light / gold dark) for the gender chart's men segment.
- **Three theming layers** in cascade order: `:root` (light defaults) → `@media (prefers-color-scheme: dark) :root:not([data-theme])` (system dark, only when no manual override) → `:root[data-theme="light|dark"]` (manual override via the theme toggle, written to `document.documentElement.dataset.theme`).
- **Mobile chrome tint.** A `<meta name="theme-color">` in `app.html` tints the mobile browser address bar with `--brand` (`#7400b8` light / `#c890ee` dark). The pre-paint script in `app.html` resolves the active theme (manual override → system preference, mirroring the cascade) and sets it before first paint (no flash); `themeToggle.apply()` re-sets it on in-app theme switches so the chrome stays in step without a reload. The literal hex values are duplicated in both places — keep them in sync with `--brand` in `app.css` if the brand colour changes.
- **`tailwind.config.js`** is a vestigial Tailwind-v3 leftover — not read for theming under v4. Do not treat it as the active source of truth.
- **Svelte `<style>` blocks** use `<style lang="postcss">` with `@reference "…/app.css"` so `@apply` resolves v4 tokens. `vitePreprocess({ style: false })` prevents vitePreprocess from running its own PostCSS pass.

---

## Copy & voice

User-facing copy follows a small house style. Apply it when writing or editing any visible text (page content, taglines, labels, notes); it does not govern code comments, `<title>` tags, or commit messages.

- **Matter-of-fact register.** State what a thing is and what happens, plainly. No marketing/salesperson tone, no rhetorical questions ("Want the short version first?"), no reader flattery or persuasion ("the only interest it serves is yours"), no hedging filler ("just", "the gist", "roughly where it stands"). The `/resources` page is the reference for the target voice: declarative, concrete, sourced.
- **Third person everywhere except the landing page.** Address the reader in the third person ("the page lists the possible matches", "a reader"), not the second ("you can pick"). The site's own first-person voice ("we"/"our"/"MIDB") is fine and intentional. **The landing page (`/`) is the sole exception** — it keeps second person ("Know before you watch") as a deliberate marketing choice.
- **No em dashes (—) in copy.** Restructure instead: split into separate sentences, or use a colon when a list/expansion follows. En dashes (–) are correct in number and relationship ranges (`0–3`, `adult–teen`) and stay.
- **Claims must be code-backed.** Anything asserted to the user (privacy properties, how a metric is computed, thresholds) must match the code. The verdict-card explainer mirrors `verdict.ts` (exact flag tiers and scoring thresholds); the landing privacy claims were verified against the codebase (no trackers, functional tokens only). When the code changes, update the copy.

---

## Routes

| Route              | Files                                                        | Status          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `+page.svelte`, `+page.server.ts`                            | **Working**     | Landing: italic brand eyebrow, large serif headline, one-sentence subhead, `HeroSearch` (live inline search), "Rate a film yourself →" CTA to `/auth`, 3-up metrics band (Bechdel / UM / DDD, one sentence each), closing note on the dual-source model that cross-links the `/resources#verdict` explainer, then a **"How MIDB is built" principles band** (privacy-first / open-source / community-funded, surfaced as bordered cards with a brand-tinted round icon badge reusing `metricArticle`'s icon vocabulary) closing with a GitHub link. Copy keeps **second person** — the only page that does (see _Copy & voice_). The privacy claims are code-backed: no analytics/trackers/ad pixels, only functional API + auth tokens (`TMDB_API_TOKEN`/`DDD_API_KEY`/`UM_KEY`/`HANKO`), no app-set tracking cookies. `+page.server.ts` returns `{}`. `heroSearch.svelte` applies landing-specific sizing and a 2px brand focus ring to the search box. |
| `/resources`       | `+page.svelte`                                               | **Working**     | Static explainer for the four metrics (verdict cards, Bechdel, UM, DDD). No server load / no DB — pure content. Sticky in-page nav (`resourceNav`, IntersectionObserver active-section highlight; vertical on desktop, sticky horizontal chip row below md) + always-open `metricArticle` sections (`#verdict`/`#bechdel`/`#unconsenting`/`#ddd`). Reuses the surface + `1.375rem` marker vocabulary via `resources/*` components. In-page anchor jumps smooth-scroll via a route-scoped `:global(html:has(.resources)) { scroll-behavior: smooth }` (only active while the page is mounted, not site-wide; disabled under `prefers-reduced-motion`; sections carry `scroll-margin-top` to clear the sticky bar). Linked from the navbar, the landing "What we check" cards, and every detail-page metric (see cross-links below).                                                                                                                        |
| `/api/search`      | `+server.ts`, `datasource.server.ts`                         | **Working**     | `GET ?q=…` proxy to TMDB **`search/multi`**. Empty/whitespace `q` short-circuits to `{ results: [] }`. Returns slim `SearchResult[]` (movies + tv only, each tagged `mediaType`). No `/search` page exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/auth`            | `+page.svelte`, `+page.ts`, `+layout.svelte`                 | Working         | Renders Hanko `<hanko-auth>`. On success redirects to `/user/profile`. `ssr=false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts`    | **Working**     | Core page — see **Detail pages** below. Shared DB/DDD logic imported from `$lib/server/*`; types from `$lib/media/types/*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/tv/[seriesId]`   | `+page.svelte`, `+page.server.ts`, `datasource.server.ts`    | **Working**     | TV-series detail page. Same metric model as movies minus Bechdel; uses `getDbMedia(series, 'tv')` and `getTriggerTagsForSeries`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/user/profile`    | `+page.svelte`, `+page.server.ts`, `availability/+server.ts` | **Working**     | Profile view/edit: avatar picker, username (debounced availability check), role badge. `?/updateProfile` form action. Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/user/dashboard`  | `+page.svelte`, `+page.ts`                                   | Working         | Hanko `<hanko-profile>` (account settings). Linked from profile. Auth-gated. `ssr=false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/user/comments`   | `+page.svelte`, `+page.server.ts`                            | Working (empty) | Comment history — empty state today; `(userId,createdAt)` query ready. Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/user/metrics`    | `+page.svelte`, `+page.server.ts`                            | Working (empty) | Rating submission history — empty state today; joins `movies` for title. Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

> **Route folders are thin:** `db.server.ts`, `ddd.server.ts`, and the route `types.ts` files that used to live under `/movie/[movieId]/` were moved to `$lib/server/data/media-queries.ts`, `$lib/server/integrations/ddd.ts`, and `$lib/media/types/{movie,series}.ts` respectively.
>
> **Removed routes:** `/movie/[movieId]/metric` and `/movie/[movieId]/metric/[metricId]` (user-driven evaluation forms) were deleted when the app moved from user-submitted evaluations to seeded source data.

---

## User & roles

Users are identified by the Hanko subject (`sub` claim in the JWT, a UUID stored as `text`). On every authenticated request, `hooks.server.ts` JIT-provisions the user row via `getOrCreateUser` (single upsert, idempotent) and populates `event.locals.user`. The root `+layout.server.ts` propagates `locals.user` to `PageData` so all pages and the navbar receive it without refetching.

**Role enum (`user_role`):** `user` | `moderator` | `administrator`. Default `user`. Authorization always reads `locals.user.role` (DB-sourced) — Hanko has no concept of MIDB roles. Promote via `bun run db:seed:admin <email>`.

**Profile fields:** `username` (varchar 32, case-insensitive unique via `lower(username)` index, validated `^[a-z0-9_]{3,32}$` + reserved-name blocklist), `avatar_key` (varchar 48, validated against avatar registry), `email` (nullable — Hanko's claim shape varies by tenant version; `emailFromClaims` handles both string and `{ address }` object forms).

**`getOrCreateUser`** does NOT bump `updated_at` — that column is only set in `updateProfile` for real edits. `COALESCE` on `email` lets a later non-null claim backfill a null without clobbering.

---

## Database schema

The active schema spans `db/schema/movie.ts`, `auth.ts`, and `community.ts`. `connections.ts` registers all three.

> The old user-evaluation model (`metrics`, `metric_options`, `evaluations`, `evaluation_results`) is gone: `db/schema/metric.ts` has been **deleted** and the migrations were **squashed** (2026-06-05), so the current `0000` baseline simply never creates those tables. (Historically they were dropped in the old migration `0006`, which no longer exists on disk.)

### Tables (active)

**`movies`** — the spine; seeded from the Bechdel CSV, enriched lazily from TMDB.

- `id` uuid PK, `imdb_id` varchar **unique NOT NULL** (cross-source join key), `tmdb_id` integer **unique nullable** (backfilled lazily), `title` varchar(255), `year` integer, `clean_title` varchar(255) (output of `normalizeTitle()` — the UM match key), `created_at`, `updated_at`.
- `clean_title` is computed via `normalizeTitle(movie.title)` in `getOrCreateDbMovie` (Bug B fixed: previously used bare `.toLowerCase().trim()` which left quote chars from TMDB titles unnormalized).

**`movie_bechdel`** — seeded, **1:1 with movie**.

- `movie_id` uuid **PK** → `movies.id` (cascade), `bechdel_id` integer, `rating` smallint (**CHECK 0..3**), `num_votes` integer, `created_at`.

**`um_source`** — spine-independent **UM catalogue**; every movie-type UM row from the CSV.

- `um_id` integer **PK**, `clean_name` varchar, `clean_title_key` varchar (year-stripped normalized key, the lookup index), `year` integer nullable, all **9 boolean flag columns**, `comment` text.
- **B-tree index `um_source_clean_title_key_idx` on `clean_title_key`** — `getUnconsentingCandidates` queries this column on every media page with no seeded UM binding (the common case); without the index that's a full table scan.
- Populated by `db:seed:um` for **all** UM movie rows regardless of whether a `movies` row exists. Enables runtime candidate lookup without re-parsing the CSV.

**`movie_unconsenting`** — seeded, **1:1 with movie**; the resolved UM binding.

- `movie_id` uuid **PK** → `movies.id` (cascade), `um_id` integer, `clean_name` varchar, `item_type` varchar, `comment` text, all **9 boolean flag columns**, `created_at`.
- Matched by `clean_title` at seed time using a year-aware policy (see Seeding). No `match_source` column — user choices are never persisted (see UM Disambiguation below).

**`movie_trigger_tags`** — DDD, **defined now, NOT written yet**.

- `id` serial PK, `movie_id` uuid, `topic_id` integer, `does_name` varchar, `yes_sum`/`no_sum` integer, `comment` text, `created_by` text → `user.id` (**`onDelete: 'set null'`**), `created_at`. Unique index on (`movie_id`, `topic_id`). DDD tags are live-only today.

**`user`** (`auth.ts`) — Hanko-sub PK. `id` text (Hanko `sub`), `email` nullable, `role` enum `user_role` default `user`, `username` varchar(32) nullable, `avatar_key` varchar(48) nullable, `created_at`, `updated_at`. Unique index on `lower(username)` (case-insensitive, NULLs don't collide). Index on `role`.

**`community_metric_submissions`** (`community.ts`) — empty, ready for write path.

- `id` uuid PK, `movie_id` → `movies.id` (cascade), `user_id` → `user.id` (cascade), `metric` enum `metric_kind` (`bechdel`|`unconsenting`|`ddd`), `value` smallint, `created_at`, `updated_at`.
- Unique on `(user_id, movie_id, metric)` — resubmit = upsert. Indexes: `(movie_id, metric)` for aggregate queries, `(user_id, created_at)` for history.

**`comments`** (`community.ts`) — empty, ready for write path.

- `id` uuid PK, `movie_id` → `movies.id` (cascade), `user_id` → `user.id` (cascade), `body` text, `created_at`, `updated_at`.
- Indexes: `(movie_id, created_at)` for title thread, `(user_id, created_at)` for history.

### Migrations

**Squashed to a single baseline (2026-06-05).** The prior chain (`0000`–`0008`) had corrupted drizzle metadata — `meta/` was missing the `0007`/`0008` snapshots (a legacy of hand-merged duplicate `0002_*` files), which made `db:generate` emit broken diffs (re-creating `um_source`, dropping already-handled tables). Since the dev DB is disposable, the entire `migrations/` folder (SQL + meta) was deleted and regenerated into one clean baseline:

- **`0000_jazzy_tag`** — the full current schema: `movies`, `movie_bechdel`, `um_source` (incl. `um_source_clean_title_key_idx`), `movie_unconsenting`, `movie_trigger_tags`, `user`.

**`0001_*`** — pending generation (`bun run db:generate` TTY). Adds: `user_role` + `metric_kind` enums, rewrites `user` table (Hanko-sub PK, new cols, `lower(username)` unique idx, drops Auth.js cols), adds `onDelete: 'set null'` to `movie_trigger_tags.created_by`, creates `community_metric_submissions` + `comments` tables with all indexes.

Future schema changes append `0002`, `0003`, … from here.

**Boot does NOT auto-migrate** (commit `742c612`). Run `bun run db:migrate` explicitly after `bun run db:generate`.

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

Both are covered by unit specs (`src/lib/media/utils/__tests__/normalizeTitle.spec.ts`).

Run order matters: **`db:seed:movies` must run before `db:seed:um`** so the `movies` spine is populated before UM tries to bind to it. Re-running either is safe.

---

## Detail pages (`src/routes/movie/[movieId]/`, `src/routes/tv/[seriesId]/`)

The flagship pages. Server-rendered for DB metrics, **streamed** for the live DDD call. Movies and series share the same DB/DDD modules in `$lib/server/*` and differ only in their TMDB datasource + which metrics apply.

**Server (movie `+page.server.ts`):**

```ts
import { getMovie } from './datasource.server';
import { getDbMovie, getBechdel, getUnconsenting } from '$lib/server/data/media-queries';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';
import { getTriggerTagsLive } from '$lib/server/integrations/ddd';

setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=3600' }); // CDN/back-forward cache
const movie = await getMovie(params.movieId); // TMDB (Bearer, credits+external_ids); cached 24h via $lib/server/cache
const dbMovie = await getDbMovie(movie); // read-only resolve; null if not seeded
const [bechdel, unconsenting] = dbMovie // skip DB round-trips when no row exists
	? await Promise.all([getBechdel(dbMovie.id), getUnconsenting(dbMovie.id)])
	: [null, null];
// No seeded UM binding → look up um_source candidates for runtime disambiguation
const umCandidates = unconsenting === null ? await getUnconsentingCandidates(movie) : [];
return {
	movie,
	bechdel,
	unconsenting,
	umCandidates,
	triggerTags: getTriggerTagsLive(movie.imdbId)
}; // UN-awaited → streamed
```

The TV `+page.server.ts` is the same shape: `getSeries(...)` → `getDbMedia(series, 'tv')` → `getUnconsenting`/`getUnconsentingCandidates` → `getTriggerTagsForSeries(series)` streamed. No Bechdel for series.

**DDD live client (`$lib/server/integrations/ddd.ts`):** `getTriggerTagsLive(imdbId)` (movies, imdb lookup) and `getTriggerTagsForSeries(series)` (title text-search + tmdb/year match). Two-step fetch with `X-API-KEY`; results cached 1h via `$lib/server/cache` (keys `ddd:imdb:…` for movies, `ddd:tmdb:…` for series). Returns `TriggerTag[]` filtered to `yesSum >= noSum && yesSum > 0`, carrying season/episode scoping for series. `_testExports()` exposes a `cache.clear()` (delegating to the shared cache) for unit tests. Public types (`TriggerTag`, `DddResult`) live in `ddd-types.ts` — `ddd.ts` re-exports them; `media/types/ddd.ts` imports from `ddd-types` directly so type consumers never transitively load the client.

**Page (`+page.svelte`) — rendered structure:**

- **`#details` header** (`movies/facts/detailHeader.svelte`): poster + title + year/runtime meta + **two-axis verdict panel** + **metric summary chips** + **fact grid** (`factGrid` for movies, `seriesFactGrid` for series). The header accepts two optional snippets: `verdict` (rendered between the year meta and the chips) and `children` (the chips + fact grid).
- **Two-axis verdict panel** — `movies/facts/verdictPanel.svelte` + `movies/facts/verdictCard.svelte`: renders a Content Safety card and a Women's Representation card. Each card shows a clean label + summary on first render; hovering/focusing (desktop) reveals a named-signal breakdown popover, tapping (touch) expands it inline — reusing the `dddTags.svelte` dual hover+tap pattern. Each card is a focusable `<button>` with `aria-expanded`; the popover is a `position:absolute` tooltip anchored to the card bottom. Safety reacts to DDD arrival because it's `$derived`; the card shows "updating…" with `aria-busy` while DDD is null. Zero layout shift: both cards always render from first paint.
- **Metric summary chips** — `movies/facts/metricChip.svelte`: one chip per metric, renders as `<a>` when `href` is given (navigates to section anchor), static `<div>` otherwise (series Bechdel N/A). The UM chip's pulsing `--accent-bg` badge is shown via `badgeCount` prop when candidates are available. Value content passed as a snippet.
- **Collapsible metric sections** — Bechdel stays inline per page; UM section is `movies/metrics/umMetricSection.svelte`; DDD section is `movies/metrics/dddMetricSection.svelte` (accepts a `selector` snippet so the series page injects the `DddEpisodeSelector` without the component knowing about seasons).
- **`#gender` section** — plain `<section>` outside the collapsible stack: `movies/facts/genderDistribution.svelte` stacked bar + legend. Men use `--seg-male` (lilac light / gold dark).
- **DDD streaming** — `createDddState(() => data.triggerTags, isSeries)` from `$lib/media/utils/dddStream.svelte.ts` wraps the cancellation-guarded `$effect`; both pages read `dddState.current`.
- **Comments skeleton** — `movies/sections/commentsSkeleton.svelte` (shared, identical across both pages).

**`$lib/server/data/media-queries.ts`** — identity resolution + metric fetches:

- `getDbMovie(media)` / `getDbMedia(media, kind)` — **read-only** identity resolution. Tries `tmdb_id` → `imdb_id`; returns the row or `null`. Used on GET routes so page visits never mutate the DB. (Movie pages call `getDbMovie`; TV pages call `getDbMedia(series, 'tv')`.)
- `getOrCreateDbMovie(media)` / `getOrCreateDbMedia(media, kind)` — **write path**. Same lookup, plus lazy id backfill and insert on miss. Reserved for future write endpoints (community ratings, persisted DDD tags) that require a guaranteed-present `movies.id` FK target.
- `getBechdel(movieId)` / `getUnconsenting(movieId)` — simple `findFirst ?? null`.

**`$lib/server/data/um-candidates.ts`** — UM disambiguation algorithm (split from `media-queries`):

- `getUnconsentingCandidates(media)` — queries `um_source` by `cleanTitleKey`; applies year-aware filtering (see UM Disambiguation); returns full flag data so a picked candidate renders identically to a seeded row.

---

## UM Disambiguation

UM is the only source with no `imdb_id`, matched purely by normalized title. When a movie has no seeded `movie_unconsenting` binding, `getUnconsentingCandidates` resolves candidates from `um_source`:

| Movie year known?              | Candidates                   | Outcome                                                                          |
| ------------------------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| Yes                            | Exact year match found       | Return that one candidate → **rendered directly, no picker** (auto-match)        |
| Yes                            | No candidate shares the year | Return `[]` → **"No data"** (film isn't in UM; don't offer mismatched-year data) |
| Unknown (0 / no `releaseDate`) | Any                          | Return all candidates → **picker shown**                                         |

**Nothing is persisted.** A user's pick lives only for the current page view — `selectedUm` is a `$state` variable, reset whenever `movie.id` changes. The page derives `umData = unconsenting ?? autoUm ?? selectedUm`; the chip, section header, and flag list all read from `umData` so a picked candidate renders identically to a seeded binding.

**Why `um_source` exists:** `movie_unconsenting` is a binding — keyed by `movie_id`, it can only hold entries that _already matched_ a spine movie. For ambiguous (same title, different year) or spine-absent films, `um_source` is the durable, re-queryable catalogue that doesn't require re-parsing the 55k-row CSV per request.

**`UmCandidate` type** (in `src/lib/media/utils/metrics.ts`) — carries `umId`, `cleanName`, `year`, `flagCount` (concern count, excluding `noRape`) + all 9 flag booleans + `comment`, making it union-compatible with `UnconsentingData` for the shared rendering path.

**`umFlagCount(umData)` / `dddUrl(itemId)`** (in `src/lib/media/utils/metrics.ts`) — pure helpers shared by both detail pages and by the `umMetricSection` / `dddMetricSection` components. `umFlagCount` excludes `noRape` from the concern tally; `dddUrl` builds the deep-link or falls back to the DDD homepage.

---

## UM flag rendering

`UM_FLAGS` defines 9 flags. `noRape` is **inverted** — `true` means _no rape or sexual assault_ (a reassurance, not a concern). It is treated specially throughout:

- **Concern count** (`umFlagCount`, picker's `flagCount`) excludes `noRape`. The chip/status reads "0 concerns" when only `noRape` is true.
- **Flag list** — every flag is a row using the **shared circular marker** (see _Shared marker pattern_ below). `noRape === true` renders with `.um-flag--reassurance`: `ri-check-line` glyph in a `--success`-tinted marker. All other present flags (`true`) → `.um-flag--present` with `ri-alert-line` in a `--warn`-tinted marker. Absent flags (`ri-subtract-line`) stay deliberately quiet — a transparent marker with a `--border` hairline outline and a half-muted glyph — so present concerns lead the eye. The list is a column-gap-only grid (`minmax(16rem, 1fr)`, `gap: 0 --spacing-lg`) so its vertical row rhythm matches the Bechdel ladder when the two sections stack.

---

## Shared marker pattern (metric row markers)

The metric sections in the detail page share **one visual language for per-item status rows**, so the stacked sections read as a family. Reuse it for any future metric checklist/ladder — don't invent a new marker shape.

- **Marker geometry.** A `1.375rem` round badge (`flex items-center justify-center rounded-full text-xs shrink-0`) holds a single Remixicon glyph or a step number. Rows are `flex items-center gap-sm`, `text-sm`, with `padding-block: var(--spacing-xs)` for the row rhythm.
- **States (tinted-fill convention).** _Active/positive_ states fill `color-mix(in oklab, var(--token) 16%, transparent)` with the solid `--token` as glyph color — the same `.status--*` convention as `collapsibleSection`. _Inactive/neutral_ states are quiet: either `--secondary-soft` bg + `--ink-muted` (Bechdel unmet) or a transparent marker with a `--border` hairline outline + half-muted glyph (UM absent). The active row's label goes `text-ink font-medium`; inactive stays `text-ink-muted`.
- **Token choice is semantic, not decorative.**
  - **Bechdel** (`movies/sections` inline in `+page.svelte`, `.criterion` / `.criterion-marker`) is a **cumulative ladder**: 3 criteria as a list with a vertical connector line (`::before`, tinted `color-mix(--success 45%, --border)` once met). Per-criterion pass/fail is colour-coded: a **met** rung uses the `--success` tint + `ri-check-line`; an **unmet** rung stays quiet (`--secondary-soft` bg + `--ink-muted`) and shows `ri-close-line` (X) instead of a step number. The section-header status pill still carries the overall `Rating N/3`. (This supersedes the earlier brand/neutral-only treatment.)
  - **UM** (`umMetricSection`, `.um-flag` / `.flag-marker`) is an **independent flag set**, so no connector line. Present concerns are a real per-item signal → `--warn` tint; the inverted `noRape` reassurance → `--success` tint. Both correctly stay colored.

---

## Component library (`src/lib/components/`)

Split into **`ui/` generic primitives** (reusable, title-agnostic) and **domain folders**. `movies/` is further split by file-type into `facts/`, `sections/`, `metrics/`, `media/`.

| Group               | Components                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/form/`          | button, linkButton, checkboxTile, radioTile                                                                                                                                                 | Status-variant button, tile-form controls. `*Tile` wrap `ui/tile/tile`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ui/tile/`          | tile, tileGrid, processTileGrid                                                                                                                                                             | Generic tile primitives. `processTileGrid` powered the deleted evaluation form — **orphaned**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ui/feedback/`      | skeleton                                                                                                                                                                                    | Shimmer block. Used by `movies/sections/sectionSkeleton` (itself orphaned).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ui/text/`          | block, tooltip                                                                                                                                                                              | Collapsible HTML block, tooltip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `user/avatars/`     | Avatar, AvatarPicker, avatars.ts, \*Icon.svelte                                                                                                                                             | Avatar system. `avatars.ts` registry (key→name→component). Six SVG icon components (Wollstonecraft, Pankhurst, Truth, de Beauvoir, Davis, Kahlo). `Avatar.svelte` renders by key; null/unknown → neutral default. `AvatarPicker.svelte` selectable grid (hidden radio + sibling CSS, reuses `radioTile` pattern). Registry `AVATAR_KEYS` set is imported by `user-queries.ts` for server-side write validation. `@reference` depth: `../../../../app.css` (4 levels).                                                                                                                                                                                                                                                                                                         |
| `ui/visualization/` | progressbar                                                                                                                                                                                 | Horizontal/vertical progress bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `theme/`            | themeToggle                                                                                                                                                                                 | Light/dark switch; reads localStorage, writes `document.documentElement.dataset.theme`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `layout/`           | navbar, navbarSearch, navbarMenu, navProgress, footer                                                                                                                                       | Global chrome, mounted in root `+layout.svelte`. `navbar` mounts search off `/` and, below `md`, folds Resources/Blog/About into `navbarMenu`. A signed-in session replaces Sign in with the avatar, profile link, and logout; Moderation shows for moderator/administrator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `landing/`          | topBar, heroSearch                                                                                                                                                                          | `heroSearch` wraps `search/movieSearch`. `topBar` is **orphaned** (superseded by `layout/navbar`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `resources/`        | resourceNav, metricArticle, subBlock, bechdelLadderExample, umFlagsExample, verdictTierExample                                                                                              | Building blocks for the static `/resources` explainer. `metricArticle` is an always-open section card (icon + `.display` title with a muted subtitle under it + body, optional external "More info" link) reusing `collapsibleSection`'s surface. `subBlock` is a labelled prose block (What it is / How it works / …). `resourceNav` is the sticky in-page nav with IntersectionObserver active-section highlight. The `*Example` components are static illustrations that **reuse the live marker CSS** — `bechdelLadderExample` copies the `.criterion` ladder, `umFlagsExample` copies the `.um-flag` grid, `verdictTierExample` renders the safety/representation tier legend tinted via `toneTokens`. Two folders deep → `@reference "../../../app.css"` (three `../`). |
| `auth/`             | hankoAuth, hankoProfile, logoutButton                                                                                                                                                       | Hanko web-component wrappers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `movies/facts/`     | detailHeader, factGrid, seriesFactGrid, genderDistribution, **castRepresentation**, **crewRepresentation**, **representationDisclosure**, **metricChip**, **verdictPanel**, **verdictCard** | Header + fact grids (movie vs series) + gender chart + cast/crew breakdown + shared metric chip + two-axis verdict. `detailHeader` gained a `verdict` snippet prop (rendered between year meta and children). `verdictPanel` composes two `verdictCard`s; each reads tone tokens from `verdict.ts` via inline CSS custom props. `castRepresentation`/`crewRepresentation` are the "see more" disclosure bodies under the `#gender` section, wrapped by `representationDisclosure` (a labelled show/hide toggle).                                                                                                                                                                                                                                                              |
| `movies/sections/`  | collapsibleSection, sectionSkeleton, description, **commentsSkeleton**                                                                                                                      | Section scaffolding. `sectionSkeleton` is **orphaned**. `commentsSkeleton` renders the loading comments section (heading + 4 skeleton rows), shared across movie and series pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `movies/metrics/`   | dddTags, dddEpisodeSelector, **umCandidates**, **umMetricSection**, **dddMetricSection**, metricsFrame                                                                                      | DDD table + episode selector + UM picker + shared metric sections. `umMetricSection` owns the full UM `CollapsibleSection` (flag list, `umCandidates` picker, comment, no-data state). `dddMetricSection` owns the DDD `CollapsibleSection` (skeleton, `DddTags`, no-data); accepts a `selector` snippet so the series page injects `DddEpisodeSelector` without the component knowing about seasons. `metricsFrame` is **orphaned** (powered the deleted metric-evaluation routes).                                                                                                                                                                                                                                                                                          |
| `movies/media/`     | image, tile, description                                                                                                                                                                    | TMDB poster `<img>` + result tile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `search/`           | movieSearch, searchInput, searchResults, searchResult, resultPoster (+ `movieSearch.svelte.ts`, `types.ts`)                                                                                 | Live inline search (see Live search below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `navigation/`       | simple, item                                                                                                                                                                                | Inline nav.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Notable mechanics:

- **`movies/sections/collapsibleSection.svelte`** — native `<details>`/`<summary>` card: rotating chevron, `.display` title, tone-coloured status pill, optional external source link, optional internal `learnHref`/`learnLabel` link to the `/resources` explainer (default label "How this works"), `children` snippet body. Bechdel/UM/DDD all pass `learnHref` so the cross-link is defined once here.
- **`movies/metrics/dddTags.svelte`** — DDD vote table. One **shared** `position: fixed` tooltip for the whole list (avoids per-row CSS hover-gap flicker). Rows with a comment are focusable `<button>`s; tooltip is positioned from the hovered row's rect, flips above/below by available room, dismisses on scroll/resize. Header row (`ddd-header`) labels the Yes/No vote columns in muted `--danger-soft`/`--success-soft` colors. Honors `prefers-reduced-motion`. Types imported from `$lib/media/types/ddd`.
- **`movies/facts/genderDistribution.svelte`** — stacked bar + legend; `total===0` empty state; men use `--seg-male`.
- **`movies/facts/castRepresentation.svelte` / `crewRepresentation.svelte`** — the `#gender` "see more" disclosure bodies. Both render as a **surface card** (`rounded-lg border border-border bg-surface-raised`) with a tinted header (`color-mix(--brand 4%, --surface-raised)`) carrying a gender **legend** (shared `seg-*` swatch classes; `--seg-male` for men), then dividered rows. Cast = Leads/Supporting/Background tiers, each a proportion bar + count chips. Crew = a department/job table with mini-bars; counts render in high-contrast `--ink` (colour identity lives in the bars + header swatches, **not** coloured digits — bright `--accent-bg` as text fails contrast). The `unknown` segment shares the track colour, so it gets an inset edge to stay visible. Wrapped by `representationDisclosure` (labelled show/hide toggle).
- **`movies/facts/metricChip.svelte`** — single summary chip. Owns all `.chip*` styles and the `badge-pulse` keyframe so they're defined once. The page wraps three chips in a `.summary-chips` grid.
- **`movies/metrics/umMetricSection.svelte`** — full UM section including flag rendering and the `umCandidates` picker fallback. Accepts `umData`, `umFlagCount`, `umCandidates`, `hasUmCandidates`, `mediaNoun`, and `onselect`. Flag rows use the **shared marker pattern** (above) — keep them in sync with the Bechdel ladder geometry.
- **`movies/metrics/dddMetricSection.svelte`** — full DDD section including loading skeleton. The `selector` snippet prop is empty for movies; the series page renders `DddEpisodeSelector` into it.
- **`$lib/media/utils/dddStream.svelte.ts`** — `createDddState(getPromise, isSeries)` rune factory. Returns `{ current: DddResult | null }`. Internally runs the cancellation-guarded `$effect` that both detail pages previously duplicated. Import with `.js` extension (`dddStream.svelte.js`) per the Svelte 5 runes-module convention.
- **`$lib/media/utils/verdict.ts`** — pure, client-safe two-axis scoring. `scoreSafety(umData, ddd)` → `SafetyVerdict`; `scoreRepresentation({cast, crew, castMembers, crewDepartments, bechdel, isSeries})` → `RepVerdict`. Each returns `{ tier, label, summary, signals: VerdictSignal[], signalsPresent, signalsTotal, tone, icon, pending? }`. `VerdictSignal = { label, detail, present, tone? }` carries per-signal human labels and findings for the hover breakdown (e.g. "Rape on screen / Flagged", "Cast — women / 22%"). Summaries are clean one-liners; the detail count is in `signals`, not appended to `summary`. `subTone(score)` maps 0/1/2 sub-scores to danger/warn/success per signal. Exported helpers: `femaleShare`, `leadsFemaleShare`, `directorOrCrewShare`, `toneTokens`, `SAFETY_HARMFUL_FLAGS`, `SAFETY_CAUTION_FLAGS`, `SV_DDD_MATCHERS`. No imports from `$lib/server/**`. Unit-tested in `src/lib/media/utils/__tests__/verdict.spec.ts`.

> **`@reference` depth note:** components now two folders deep under `ui/*` or `movies/*` use `@reference "../../../../app.css"` (four `../`) in their `<style>` blocks; shallower components (e.g. `layout/`, `search/`) keep three. Getting this wrong surfaces as a Tailwind CSS-resolution error in unit tests, not a type error.

---

## Live search (`src/lib/components/search/`)

- **`movieSearch.svelte.ts`** — `MovieSearchState` rune class: `query`, `results`, `activeIndex`, `loading`, `open`. Owns the debounced RxJS store (500ms), keyboard model (Arrow wrap-around, Enter→select, Escape→close), and navigation, which branches on `mediaType` (`resolve('/tv/[seriesId]', …)` vs `resolve('/movie/[movieId]', …)`). `optionId(id, mediaType)` builds the stable `aria-activedescendant` ids.
- **`movieSearch.svelte`** — orchestrator: instantiates state, wires `$effect(() => search.connect())`, click-outside dismiss, composes child components. Import uses **`.js` extension** (`./movieSearch.svelte.js`) so Vite resolves the `.svelte.ts` module, not the component. Mounted on the landing hero (`landing/heroSearch.svelte`).
- **Two independent consumers of `MovieSearchState`.** The landing hero uses the full `movieSearch.svelte` (bordered input + submit button via `searchInput`). The global navbar uses `layout/navbarSearch.svelte` — a separate, minimalistic consumer that reuses `MovieSearchState` + `searchResults` directly with its own compact, collapse-by-default field (no submit button). Each consumer instantiates its own `MovieSearchState`; the navbar one only mounts on non-landing routes (`pathname !== '/'`).
- Panel visibility is `open && query.trim()` — `close()` flips `open` but preserves `query`/`results` so re-focus re-shows prior results without refetch.

---

## Server cache (`src/lib/server/cache/`)

A single swappable cache fronts every external call so repeat detail-page visits skip the round-trip that dominates latency.

- **API.** `getCached<T>(key, ttlMs, fetcher)` — returns the cached value or runs `fetcher`, stores it, and returns it. Backend failures degrade to a cache miss (the fetcher still runs), so caching can never make a request fail — only slower. `clearCache()` is exposed for tests.
- **Backend selection** is a deploy-time decision via one env var, not a code change:
  - **No `REDIS_URL`** → bounded in-process LRU (`MAX_ENTRIES = 500`, TTL'd, insertion-order eviction with read-touch). Persists for the process lifetime — right for a single long-lived Node server.
  - **`REDIS_URL` set** → Redis backend. The `redis` package is an **optional dependency**, imported lazily (`await import(/* @vite-ignore */ 'redis')`) so the app builds and runs without it installed; the `@vite-ignore` stops Vite from failing the build when it's absent.
- **Keys** are namespaced: `tmdb:movie:<id>`, `tmdb:series:<id>` (24h TTL); `ddd:imdb:<id>`, `ddd:tmdb:<id>` (1h TTL).
- **Why Redis is optional:** on a single Node process the in-memory cache already survives between requests. Redis earns its place only to share the cache across instances or survive restarts/deploys (and on ephemeral serverless). See `README.md` for the opt-in setup.

---

## TMDB integration

- **Shared client** `$lib/server/integrations/tmdb.ts` — `TMDB_BASE`, `tmdbHeaders()` (Bearer), and `aggregateGender(credits)` (0/1/2/3 → unknown/female/male/nonBinary). Used by all three datasources.
- **`movie/[movieId]/datasource.server.ts`** — `getMovie(id)` fetches `append_to_response=credits,external_ids`, maps to `Movie` (incl. `imdbId` from `external_ids`), aggregates cast/crew gender server-side. Wrapped in `getCached('tmdb:movie:<id>', 24h, …)`.
- **`tv/[seriesId]/datasource.server.ts`** — `getSeries(id)` fetches the `/tv/{id}` equivalent, mapping seasons/networks/created-by into `Series`. Wrapped in `getCached('tmdb:series:<id>', 24h, …)`.
- **`api/search/datasource.server.ts`** — `search(q)` → TMDB **`search/multi`**, filtered to movie/tv. Shared `SearchResult` type with client components via `$lib/components/search/types`.
- **`movies/media/image.svelte`** — responsive `srcset` from `PUBLIC_TMDB_IMAGE_URL`; `src` defaults to `w500`. `search/resultPoster.svelte` builds a fixed `w92` URL directly (keeps the 20-row search list cheap).

---

## Auth flow (Hanko)

1. `/auth` renders `<hanko-auth>` → success event → `goto("/user/profile")`.
2. Hanko sets a `hanko` JWT cookie.
3. `hooks.server.ts` verifies it via **module-level** `createRemoteJWKSet` (created once; `jose` caches JWKS on the instance). On success: decodes payload, extracts email via `emailFromClaims` (handles `string` or `{ address }` object shapes), calls `getOrCreateUser({ sub, email })`, sets `event.locals.user`. On failure: `locals.user = null`.
4. Any `/user/*` request with `locals.user === null` → `redirect(303, "/auth")`. `/user/moderation` additionally checks `role === 'moderator' | 'administrator'`, throws `error(403)` otherwise.
5. Root `+layout.server.ts` returns `{ user: locals.user }` → `PageData` → all pages + navbar receive user without a second DB round-trip.
6. `/user/profile` — profile view/edit (avatar + username). `/user/dashboard` — Hanko `<hanko-profile>` (account settings). `/user/comments`, `/user/metrics` — history views.
7. `logoutButton.svelte` calls the Hanko client's logout then redirects to `/auth`.

---

## Configuration & environment

| Var                     | Used by                                          | Notes                                                                                                                                  |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_CONNECTION`         | `connections.ts`                                 | Postgres URL. Local dev: `postgres://postgres:mysecretpassword@0.0.0.0:5435/midb`                                                      |
| `PUBLIC_HANKO_API_URL`  | hooks + auth components                          | Hanko Cloud tenant URL                                                                                                                 |
| `PUBLIC_TMDB_API_URL`   | movie + search datasources                       | `https://api.themoviedb.org`                                                                                                           |
| `PUBLIC_TMDB_IMAGE_URL` | image component                                  | `https://image.tmdb.org/t/p`                                                                                                           |
| `TMDB_API_TOKEN`        | `$lib/server/integrations/tmdb.ts` (server only) | v4 Bearer token. `$env/static/private`.                                                                                                |
| `DDD_API_KEY`           | `$lib/server/integrations/ddd.ts` (server only)  | Does The Dog Die API key, `X-API-KEY` header.                                                                                          |
| `REDIS_URL`             | `$lib/server/cache` (server only)                | **Optional.** When set, the cache uses Redis instead of in-process LRU. Requires the optional `redis` package. `$env/dynamic/private`. |

### Local run sequence

```bash
docker run --name midb-pg -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=midb -p 5435:5432 -d postgres:16
bun install
bun run db:migrate       # optional — dev/boot also runs migrations via hooks.server.ts
bun run db:seed:movies   # must run before db:seed:um
bun run db:seed:um
bun run db:backfill:tmdb # optional: resolve tmdb_id ahead of time
bun run dev
```

### npm scripts

`dev` / `build` / `preview` · `check` · `test` = `test:integration` + `test:unit` · `lint` / `format` · `storybook` / `build-storybook` · `db:generate` · `db:migrate` · `db:seed:movies` · `db:seed:um` · `db:backfill:tmdb` · `db:seed:admin <email>` (case-insensitive promote to administrator).

### CI (`.github/workflows/tests.yml`)

Runs on every PR, on pushes to `main`, and on manual dispatch. Bun is pinned to the local version.

- **`unit`**: `bun install --frozen-lockfile` → `bun run test:unit --run`. Needs no secrets, because unit specs mock `$env/*`.
- **`e2e`**: skipped unless the repo variable `E2E_ENABLED` is `'true'`. It starts a `postgres:16` service, runs `db:migrate`, then `bun run test:integration`; `playwright.config.ts` builds and previews the app itself. It needs the secrets `TMDB_API_TOKEN` and `DDD_API_KEY` and the variable `PUBLIC_HANKO_API_URL`. The Playwright report is uploaded on failure.

---

## Known gaps / TODO

1. **`bun run db:generate` + `bun run db:migrate` pending** — schema changes (user rewrite + community tables) are in code but migration `0001_*` has not been generated or applied yet. Run `bun run db:generate` in a real terminal (may prompt for rename vs drop on the `user` rewrite — dev DB is disposable), then `bun run db:migrate`.
2. **DDD persistence not built** — `movie_trigger_tags` exists but is never written; DDD tags are live-only. Deferred to a future user-interaction phase.
3. **Community write path not built** — `community_metric_submissions` and `comments` tables exist and are index-ready but have no write endpoints. Empty-state history views are wired at `/user/metrics` and `/user/comments`. The write path (rating submission + comment posting on title detail pages) is the next milestone.
4. **Orphaned UI** — `ui/tile/processTileGrid`, `movies/metrics/metricsFrame`, `movies/sections/sectionSkeleton`, and `landing/topBar` are no longer rendered anywhere; candidates for removal.
5. **UM data is sparse by design** — ~2,858 of ~9,710 spine movies have a UM binding (latest reseed). "No data" is the common, correct state. ~35 title collisions are left as runtime-picker cases (year unknown); ~7,483 have no UM entry at all.
6. **No Storybook stories** for detail-page components (`collapsibleSection`, `dddTags`, `genderDistribution`, `factGrid`, `seriesFactGrid`, `detailHeader`, `umCandidates`).
7. **`movie.tagline`/`overview` mapped but unused** — the header dropped the plot summary in favour of metric chips; both fields stay in the `Movie` shape for potential later use.
8. **`db:generate` requires a TTY** — drizzle-kit's interactive conflict-resolution prompts require a real terminal. Run it from the terminal, not from a CI/non-interactive shell.

> Verification baseline after the `$lib` reorg: `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean.
> Verification baseline after the detail-page refactor (server splits + shared components): same — `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean.
> Verification baseline after the cache layer + startup-migrations + migration squash + dead-seeder removal (2026-06-05): same — `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean. Removed deps: `@loom-io/fs`, `marked` (orphaned with `seed.ts`).
> Verification baseline after user schema + auth flow (2026-06-21): same — `bun run check` → 0 errors/warnings, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean. Migration `0001_*` pending `bun run db:generate` + `bun run db:migrate`.

---

## Related docs

- `.CLAUDE/plans/plan-architecture-remediation.md` — 7-PR plan implementing every review finding (session out of SSR, runtime DB config + drift CI, `titles` spine, module consolidation, deps/cleanup, docs). Not yet started.
- `.CLAUDE/plans/plan-architecture-review.md` — architecture review (2026-10-24): P0 fixes (committed secret, CDN-cached personalised HTML, migration drift), proposed `titles` spine + per-metric community tables, and a suggested ordering before the community write path.
- `.CLAUDE/plans/plan-um-matching-fix.md` — the plan that drove the UM matching overhaul (year-aware seeder, `um_source` table, runtime disambiguation picker, `noRape` inversion). Implemented and closed.
- `.CLAUDE/plans/plan-movie-schema-multi-source.md` — the plan that drove the multi-source schema (Bechdel + UM seeding, streamed DDD, page redesign).
- `.CLAUDE/plans/major-version-upgrade.md` — phased dep-upgrade plan.
- `.CLAUDE/plans/plan-a-landing-page.md`, `.CLAUDE/plans/plan-landing-page-search.md` — landing-page and search design notes.
- `.CLAUDE/plans/plan-movie-detail-sections-1-2.md` — **superseded** earlier §1–2 detail-page design; kept for history.
- `.CLAUDE/plans/plan-user-schema-auth-flow.md` — the plan that drove the user schema + auth flow (Hanko-sub PK, JIT provision, roles, avatar system, profile/history routes). Implemented 2026-06-21.
- `README.md` (repo root) — original setup notes (contains stale Auth.js-era env vars).
