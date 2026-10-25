# MIDB — Architecture Reference

> Snapshot as of 2026-06-08 (branch `main`), schema sections updated 2026-10-24 (remediation PR 4), dependencies, search and dead code 2026-10-25 (remediation PR 6). The detail pages are built around a **multi-source metrics model** — a `titles` spine (movies and TV), seeded source-of-truth tables (`title_bechdel`, and `title_um` bindings into the **spine-independent UM catalogue** `um_source`) and a **live-fetched, streamed** Does-The-Dog-Die client. Both **movies and TV series** are supported (`/movie/[movieId]`, `/tv/[seriesId]`). Each metric is planned to display **two scores side by side**: the original authoritative source and a **MIDB community rating**; titles will also have a **comments section**. The old user-evaluation schema was removed (and the migrations later squashed to a clean `0000` baseline) but the product direction has pivoted back to community contribution — community rating + comments are the next major feature milestone. Earlier work (landing page + theme toggle, live inline `/api/search`, global nav/footer, Svelte 5 / Vite 8 / Tailwind 4 / Storybook 10 stack) still stands.
>
> **The `src/lib` tree was reorganised by domain + file-type** (see Directory layout + File-organisation conventions): shared server logic moved out of route folders into `$lib/server/{data,integrations}`, shared types/utils into `$lib/media/{types,utils}`, and components split into `$lib/components/ui/*` (generic primitives) vs domain folders. Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for displaying movies and TV series through a **diversity / content-safety lens**. The audience is survivors and trauma-sensitive viewers, and people who care about women's representation — people deciding whether a title is safe to watch. Users find a title and see how it scores across structured **metrics** — formal tests and content advisories for representation and harm. Three sources are wired today: the **Bechdel Test**, **Unconsenting Media** (sexual-violence advisories), and **Does The Dog Die** (crowd-sourced trigger tags).

Title facts (poster, overview, release/air date, credits, seasons) are **not stored** — they're fetched live from **TMDB** on each request. What _is_ stored locally is a thin spine (`titles`, keyed by `(kind, tmdb_id)` for films and series) plus **seeded, authoritative metric data** (Bechdel rating, UM advisory flags) and a **spine-independent UM catalogue** (`um_source`) that powers the runtime disambiguation picker. DDD data is fetched live and streamed, not persisted.

Each metric is designed to show **two scores side by side**: the original authoritative source (Bechdel, UM, DDD) and a **MIDB community rating** contributed by users who have watched the film. Movies will also have a **comments section** for viewer context and discussion. Community ratings and comments are the next major feature milestone — the per-metric community tables and `comments` exist (remediation PR 4) and the `/user/*` area will expand beyond the current Hanko profile stub.

---

## Tech stack

| Layer                     | Technology                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                 | SvelteKit 2.21 + **Svelte 5** (runes: `$props`/`$state`/`$derived`, snippets; SSR + client hydration)                                                                                                                               |
| Runtime / package manager | **Bun** 1.4.4 everywhere: `packageManager: bun@1.4.4` in `package.json`; CI and Vercel install with `bun install --frozen-lockfile` (lockfile is JSON `bun.lock`)                                                                   |
| Build / dev               | **Vite 8**; deployed with `@sveltejs/adapter-vercel` 6                                                                                                                                                                              |
| Styling                   | **Tailwind CSS 4 (CSS-first)** via `@tailwindcss/vite` — no PostCSS config; design tokens live in `src/app.css`. Remixicon for icons.                                                                                               |
| Database                  | PostgreSQL via **Drizzle ORM** 0.45 (`postgres-js` 3.4 driver) + drizzle-kit 0.31                                                                                                                                                   |
| Auth                      | **Hanko** (passwordless / passkeys) via `@teamhanko/hanko-elements` 2.6; JWT verified with `jose` 6                                                                                                                                 |
| External movie data       | **TMDB** REST API v3 (Bearer-token auth); **Does The Dog Die** API (live trigger tags, `X-API-KEY`)                                                                                                                                 |
| Server cache              | Swappable backend (`$lib/server/cache`): bounded in-memory LRU by default; **Redis** (optional, lazy `redis` pkg) when `REDIS_URL` is set. Caches TMDB (titles, search) + DDD responses and holds the rate-limit counters (`incr`). |
| Seed parsing              | **`csv-parse`** 6 (stream-parse the Bechdel + UM source CSVs)                                                                                                                                                                       |
| Testing                   | Vitest 4 (projects `unit` + `db` against real Postgres, co-located in `__tests__/`), Playwright 1.61 (integration, in `e2e-tests/`), Storybook 10 (component dev)                                                                   |
| Client debounce / ids     | `DebouncedQuery` (`$lib/media/utils/debouncedQuery.svelte.ts`): timer + `AbortController`, no RxJS. Element ids from Svelte's `$props.id()`, no nanoid                                                                              |
| Lint                      | ESLint 10 (flat config) + `@typescript-eslint/*` 8 + Prettier                                                                                                                                                                       |

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
              credits / imdb_id    trigger tags    titles + Bechdel + UM
              (cached 24h)

   Auth:  Browser ⇄ Hanko Cloud (web components + JWT cookie)
          hooks.server.ts verifies the `hanko` cookie via remote JWKS
   Startup: hooks.server.ts runs migrateDatabase() once at server boot
```

- **Entry point** is the landing page at `/` (hero + search UX). The hero search is a **live, inline TMDB search**: typing queries a server proxy (`/api/search`, TMDB `search/multi`) and renders a results dropdown in place — there is no `/search` page. Results carry a `mediaType` (`movie`/`tv`) and route to the matching detail page.
- **Title identity** flows by **TMDB id** through the URL (`/movie/[movieId]`, `/tv/[seriesId]`), but the internal join key across metric sources is **`imdb_id`** (the Bechdel/DDD key). On a detail-page load the live TMDB title is resolved to a local `titles` row via **read-only** `getTitleRow(kind, ref)` (matching on `(kind, tmdb_id)` then `imdb_id`); a GET never mutates the DB. Movies and series share the TMDB numeric id space, so `kind` is part of the key; there are no synthetic ids.
- **Metric data** comes from three places: **Bechdel + UM** are seeded into Postgres and rendered server-side (SSR); **DDD** is fetched live from its API and **streamed** so a slow external call never blocks first paint. (Bechdel is movie-only; series surface UM + DDD.)
- **Caching.** TMDB title fetches (`getMovie`/`getSeries`), TMDB search (`searchTitles`, 10 min) and DDD lookups go through `$lib/server/cache` so repeat visits to a title skip the external round-trip — the dominant source of detail-page latency. Default backend is a bounded in-process LRU (fine on a long-lived Node server); set `REDIS_URL` for a shared backend that survives restarts / scales across instances. Detail loads also set `cache-control: public, max-age=0, s-maxage=3600` so the browser/back-forward cache and any CDN can serve repeat navigations.
- **Auth** is entirely Hanko's; the app only verifies the JWT cookie server-side to gate `/user/*`.

---

## Directory layout

```
MIDB/
├── db/                         # Data layer — lives OUTSIDE src/, aliased as $db/*
│   ├── client.ts               # createDb(url, { max? }) → { db, sql } (connect_timeout 10, schema barrel) + type Db. Reads no env
│   ├── schema/                 # Drizzle table definitions (drizzle-kit reads ./schema/**/*.ts)
│   │   ├── index.ts            # barrel re-exporting every schema file (passed to drizzle() as `schema`)
│   │   ├── columns.ts          # shared column sets: timestamps() (timestamptz, $onUpdate) + umFlagColumns() (the 9 UM flags)
│   │   ├── titles.ts           # title_kind enum + titles (the spine; unique (kind, tmdb_id), unique imdb_id)
│   │   ├── sources.ts          # titleBechdel + umSource (UM catalogue) + titleUm (binding only)
│   │   ├── auth.ts             # user (Hanko-sub PK, role enum, username/avatarKey, lower(username) idx)
│   │   └── community.ts        # communityBechdelRatings, communityUmReports, communityDddVotes, comments (empty, no write path yet)
│   ├── scripts/
│   │   ├── migrate.ts          # `bun run db:migrate`; exports migrateDatabase(url) (max: 1), also used by db/test/global-setup.ts
│   │   ├── seedMovies.ts       # `db:seed:movies` — Bechdel CSV → titles (kind movie) + title_bechdel; exports seedMovies(db, csvPath)
│   │   ├── seedUnconsenting.ts # `db:seed:um` — UM CSV → um_source (all rows) + title_um bindings (matched); exports seedUnconsenting(db, csvPath, reportPath?)
│   │   ├── seedAdmin.ts        # `db:seed:admin <email>` — case-insensitive promote to administrator
│   │   ├── backfillTmdb.ts     # `db:backfill:tmdb` — fill null tmdb_id on movie titles via TMDB /find
│   │   ├── __tests__/          # seeders.db.spec.ts (smoke test on the 50-row fixtures)
│   │   └── lib/                # script-only: db.ts (script client from process.env.DB_CONNECTION + closeDb), checkCsvColumns.ts
│   ├── lib/                    # code shared by the seeders and the app (app imports $db/lib/*, seeders ../lib/*)
│   │   ├── normalizeTitle.ts   # normalizeTitle + stripTrailingYear: the matching key, identical at seed time and at runtime
│   │   └── __tests__/          # normalizeTitle.spec.ts (unit project: db/**/*.spec.ts minus *.db.spec.ts)
│   ├── seeds/
│   │   └── sources/            # raw CSVs: bechdel.csv, unconsenting.csv, unconsenting_unmatched.txt (report)
│   ├── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots (never hand-edited)
│   └── test/                   # Vitest `db` project harness
│       ├── global-setup.ts     # wipes TEST_DB_CONNECTION (refuses if it equals DB_CONNECTION) and migrates it from zero
│       ├── reset.ts            # setupFile: TRUNCATE every schema table RESTART IDENTITY CASCADE beforeEach; closeDb afterAll
│       ├── community.db.spec.ts # community table constraints (kept out of db/schema/: drizzle-kit loads every .ts there)
│       └── fixtures/           # 50-row bechdel.csv + unconsenting.csv for the seeder smoke test
│
├── src/
│   ├── hooks.server.ts         # Auth gate: verifies `hanko` JWT → locals.claims (no DB), lazy memoised locals.getUser(), gates /user + /user/* on claims, role check on /user/moderation*
│   ├── app.css                 # Tailwind v4 entry + design tokens + @layer components
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── routes/                 # File-based routing (see below). Route folders hold ONLY
│   │   │                       #   +page.svelte / +page.server.ts / +server.ts — shared logic lives in $lib.
│   │   ├── +layout.svelte      # Root shell: app.css + remixicon, global Navbar + <main> + Footer (no root server load: SSR is user-agnostic)
│   │   ├── +error.svelte       # Error boundary (404 + fallback), rendered inside the shell's <main>
│   │   ├── api/me/+server.ts   # GET → PublicUser | null, `private, no-store` (source of the client session)
│   │   └── user/+layout.*      # requireUser → { me: PublicUser }, `private, no-store`; +layout.svelte hands `me` to the session
│   └── lib/
│       ├── server/             # SvelteKit-ENFORCED server-only boundary (no client import)
│       │   ├── db.ts           # the app's `db`: lazy createDb on first use from $env/dynamic/private DB_CONNECTION
│       │   │                   #   (TEST_DB_CONNECTION under Vitest); throws if unset, no localhost fallback; closeDb() (+ __tests__/)
│       │   ├── data/           # Postgres / Drizzle access, all via $lib/server/db (+ __tests__/, incl. *.db.spec.ts)
│       │   │   ├── title-queries.ts  # identity resolution: getTitleRow(kind, ref) (read-only) + getOrCreateTitleRow (write path, unused by GETs)
│       │   │   ├── sources.ts        # seeded metric reads: getBechdel, getUmEntry (title_um → um_source) + toUmEntry mapper
│       │   │   ├── um-candidates.ts  # UM disambiguation algo: getUnconsentingCandidates (maps rows with toUmEntry)
│       │   │   ├── pg-errors.ts      # isUniqueViolation (walks DrizzleQueryError's cause chain for 23505)
│       │   │   └── user-queries.ts   # read-first JIT provision + toPublicUser + profile update (validated) + username availability + history queries (comments, community ratings)
│       │   ├── auth/           # (+ __tests__/)
│       │   │   ├── hanko.ts          # module-level JWKS, verifyClaims(event), emailFromClaims(payload)
│       │   │   └── guards.ts         # requireUser / requireRole: redirect (page) or 401/403 (actions, endpoints)
│       │   ├── http/           # (+ __tests__/)
│       │   │   ├── cache.ts          # cache-control constants: PUBLIC_PAGE, PUBLIC_SEARCH, PRIVATE_NO_STORE (see Caching policy)
│       │   │   └── rate-limit.ts     # rateLimit(event, bucket, limit, windowMs, { userId? }): fixed window on cache incr, error(429), fails open
│       │   ├── titles/
│       │   │   └── load-title.ts     # loadTitle(kind, tmdbId): the one detail-page loader (TMDB → titles row → sources → candidates → streamed DDD) (+ __tests__/)
│       │   ├── integrations/   # External API clients (hold secrets) (+ __tests__/)
│       │   │   ├── tmdb/             # the TMDB integration (+ __tests__/ with recorded fixtures/ and a mapper snapshot)
│       │   │   │   ├── client.ts     # tmdbFetch(path, params): bearer headers, HttpError mapping; tmdbCached (getCached, 24 h); TMDB_SEARCH_TTL_MS (10 min)
│       │   │   │   ├── mappers.ts    # pure: aggregateGender, buildCastMembers, buildCrewDepartments, mapMediaDetail, mapMovie, mapSeries, mapSearchResults
│       │   │   │   └── index.ts      # getMovie(id), getSeries(id), searchTitles(q) (cached 10 min per lowercased query; throws on a TMDB error)
│       │   │   ├── ddd.ts            # DDD client; uses $lib/server/cache; re-exports TriggerTag/DddResult from ddd-types
│       │   │   └── ddd-types.ts      # public domain types: TriggerTag, DddResult (no client import of secrets)
│       │   └── cache/          # getCached(key, ttlMs, fetcher) + incr(key, ttlMs) counters: in-memory default, Redis if REDIS_URL set (+ __tests__/)
│       ├── media/              # Shared, client-safe media domain (movies + series)
│       │   ├── types/          # media.ts (MediaDetail/GenderBreakdown), movie.ts, series.ts,
│       │   │                   #   ddd.ts (type-only re-export from integrations/ddd-types), um.ts (UmEntry/UmFlagKey re-export),
│       │   │                   #   user.ts (PublicUser DTO + type-only UserRole re-export; UserRow is NOT re-exported)
│       │   └── utils/          # format.ts (Intl), metrics.ts (BECHDEL_TIERS/UM_FLAGS/UmEntry/dddUrl/umFlagCount), titleHref.ts,
│       │                       #   departments.ts (PRIORITY_DEPARTMENTS), avatars.ts (AVATAR_DEFS/AVATAR_KEYS, plain data),
│       │                       #   dddStream.svelte.ts (createDddState rune factory), debouncedQuery.svelte.ts (DebouncedQuery:
│       │                       #   debounce + AbortController for typed queries), search.ts (SEARCH_QUERY_MAX_LENGTH = 120),
│       │                       #   titleView.svelte.ts (TitleView: detail-page state), episodeFilter.svelte.ts (TV season/episode filter),
│       │                       #   session.svelte.ts (client session rune: pending | anon | user) (+ __tests__/)
│       ├── components/         # Reusable UI: ui/* primitives + domain folders (see Component library)
│       └── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│
├── e2e-tests/                  # Playwright integration tests (testDir; renamed from tests/): landing + navbar search overflow
├── .github/workflows/tests.yml # CI: static (check/lint/build), unit, migrations (drift), db (Postgres), gated e2e (see CI)
├── docker-compose.yml          # local Postgres: `db` service, postgres:16, DB `midb` on 5432
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, dialect/credentials)
├── eslint.config.js            # flat config: typescript-eslint + svelte recommended + prettier
├── .prettierrc / .prettierignore # tabs, single quotes, width 100; ignores db/migrations (drizzle-kit output)
├── playwright.config.ts        # testDir: 'e2e-tests'; webServer `bun run build && bun run preview` on 4173
├── svelte.config.js            # adapter-vercel; alias $db/* → ./db/*; vitePreprocess({ style:false })
├── vercel.json                 # installCommand `bun install --frozen-lockfile`, buildCommand `bun run build`
├── vite.config.ts              # tailwindcss() + sveltekit() + svelteTesting() + Vitest projects `unit` (jsdom) and `db` (node, real Postgres). No `define`, no build-time env
├── README.md                   # short local setup (compose + seeds), points here and at AGENTS.md
├── .env.example                # committed template: every var with check/build-safe placeholders
└── .env                        # local copy of .env.example (git-ignored): DB_CONNECTION, TEST_DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN, DDD_API_KEY, REDIS_URL (optional)
```

**Key structural choices:**

- The database layer (`db/`) sits _outside_ `src/`, exposed via the `$db/*` alias in `svelte.config.js`. App code imports `db` from `$lib/server/db` (lazy, runtime env); scripts import it from `db/scripts/lib/db.ts`. Both build it with `createDb` from `$db/client`, which reads no env itself.
- **Shared server logic does not live inside route folders.** Anything two routes both need (DB queries, external API clients) lives under `$lib/server/`; route folders keep only their route files (`+page.svelte` / `+page.server.ts` / `+server.ts`).

### File-organisation conventions

- **`$lib/server/**` is the server-only boundary.** SvelteKit fails the build if any client-reachable code imports from it. Secrets (`TMDB_API_TOKEN`, `DDD_API_KEY`) and DB access live here only. `data/`= Postgres;`integrations/` = external HTTP clients.
- **Components for types, never routes.** A component that needs a `Movie`/`Series`/`TriggerTag` type imports it from `$lib/media/types/*` — `media/types/ddd.ts` re-exports DDD types from `integrations/ddd-types.ts` (not `ddd.ts`) as **types only** (erased at build, so no server runtime leaks into the client bundle). Components no longer reach back into `routes/.../`.
- **`ui/` vs domain.** Generic, reusable primitives (button, tile, skeleton, tooltip, progressbar) live in `$lib/components/ui/*`; title-specific UI lives in domain folders (`movies/*`, `search/*`, …).
- **Imports use `$lib`/`$db` aliases**, with relative `./` reserved for same-folder siblings.
- **Tests are co-located in a `__tests__/` subfolder** at each location (the `unit` project globs `src/**/*.{spec,test}.{js,ts}` and `db/**/*.spec.ts` at any depth). Specs that touch Postgres are named `*.db.spec.ts` and run only in the `db` project (`bun run test:db`); the `unit` project excludes them and mocks `$lib/server/db`. Playwright e2e specs live in top-level `e2e-tests/`.

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

| Route              | Files                                                        | Status          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                | `+page.svelte`, `+page.server.ts`                            | **Working**     | Landing: italic brand eyebrow, large serif headline, one-sentence subhead, `HeroSearch` (live inline search), "Rate a film yourself →" CTA to `/auth`, 3-up metrics band (Bechdel / UM / DDD, one sentence each), closing note on the dual-source model that cross-links the `/resources#verdict` explainer, then a **"How MIDB is built" principles band** (privacy-first / open-source / community-funded, surfaced as bordered cards with a brand-tinted round icon badge reusing `metricArticle`'s icon vocabulary) closing with a GitHub link. Copy keeps **second person** — the only page that does (see _Copy & voice_). The privacy claims are code-backed: no analytics/trackers/ad pixels, only functional API + auth tokens (`TMDB_API_TOKEN`/`DDD_API_KEY`/`UM_KEY`/`HANKO`), no app-set tracking cookies. `+page.server.ts` sets `PUBLIC_PAGE` and returns `{}`. `heroSearch.svelte` applies landing-specific sizing and a 2px brand focus ring to the search box. |
| `/resources`       | `+page.svelte`, `+page.server.ts`                            | **Working**     | Static explainer for the four metrics (verdict cards, Bechdel, UM, DDD). No DB — pure content; the server load only sets `PUBLIC_PAGE`. Sticky in-page nav (`resourceNav`, IntersectionObserver active-section highlight; vertical on desktop, sticky horizontal chip row below md) + always-open `metricArticle` sections (`#verdict`/`#bechdel`/`#unconsenting`/`#ddd`). Reuses the surface + `1.375rem` marker vocabulary via `resources/*` components. In-page anchor jumps smooth-scroll via a route-scoped `:global(html:has(.resources)) { scroll-behavior: smooth }` (only active while the page is mounted, not site-wide; disabled under `prefers-reduced-motion`; sections carry `scroll-margin-top` to clear the sticky bar). Linked from the navbar, the landing "What we check" cards, and every detail-page metric (see cross-links below).                                                                                                                       |
| `/api/search`      | `+server.ts`                                                 | **Working**     | `GET ?q=…` proxy to TMDB **`search/multi`** via `searchTitles` (`$lib/server/integrations/tmdb`). Empty/whitespace `q` short-circuits to `{ results: [] }`. Returns slim `SearchResult[]` (movies + tv only, each tagged `mediaType`). No `/search` page exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/api/me`          | `+server.ts`                                                 | **Working**     | `GET` → `PublicUser \| null` via `locals.getUser()` + `toPublicUser`, always `cache-control: private, no-store`. Fetched once per full page load by the client session (see _Auth flow_).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/auth`            | `+page.svelte`, `+page.ts`, `+layout.svelte`                 | Working         | Renders Hanko `<hanko-auth>`. On success redirects to `/user/profile`. `ssr=false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`                            | **Working**     | Core page — see **Detail pages** below. The load is `setHeaders(PUBLIC_PAGE)` + `loadTitle('movie', id)`; page state is `TitleView`; types from `$lib/media/types/*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/tv/[seriesId]`   | `+page.svelte`, `+page.server.ts`                            | **Working**     | TV-series detail page. Same metric model as movies minus Bechdel: `loadTitle('tv', id)` (`getTitleRow('tv', …)`, `getTriggerTagsForSeries`) and `TitleView` with its `EpisodeFilter`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/user/*` layout   | `+layout.server.ts`, `+layout.svelte`                        | **Working**     | `requireUser(locals, { page: true })` → `{ me: PublicUser }`, `cache-control: private, no-store` for every `/user/*` page. `+layout.svelte` calls `session.set(data.me)` in an effect (browser only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/user/profile`    | `+page.svelte`, `+page.server.ts`, `availability/+server.ts` | **Working**     | Profile view/edit: avatar picker, username (debounced availability check), role badge. Reads `me` from the layout; its own load returns `email`, the only route that sends it to the client. `?/updateProfile` (guarded, 401) returns `me: PublicUser`. `availability` is guarded (401). Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/user/dashboard`  | `+page.svelte`, `+page.ts`                                   | Working         | Hanko `<hanko-profile>` (account settings). Linked from profile. Auth-gated. `ssr=false` (the `/user` layout's server load still runs and sets the session).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/user/comments`   | `+page.svelte`, `+page.server.ts`                            | Working (empty) | Comment history — empty state today; `getUserComments` joins `titles` and links via `titleHref`. Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/user/metrics`    | `+page.svelte`, `+page.server.ts`                            | Working (empty) | Community rating history (Bechdel ratings + UM reports via `getUserRatings`) — empty state today; joins `titles` and links via `titleHref`. Auth-gated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

> **Route folders are thin:** they hold only `+page.svelte` / `+page.server.ts` / `+server.ts` (plus `+layout.*` / `+page.ts` where SvelteKit needs them). The old route `datasource.server.ts` files (movie, tv, `api/search`) became `$lib/server/integrations/tmdb/` (remediation PR 5); `db.server.ts`, `ddd.server.ts` and the route `types.ts` files went earlier to `$lib/server/data/*`, `$lib/server/integrations/ddd.ts` and `$lib/media/types/{movie,series}.ts`.
>
> **Removed routes:** `/movie/[movieId]/metric` and `/movie/[movieId]/metric/[metricId]` (user-driven evaluation forms) were deleted when the app moved from user-submitted evaluations to seeded source data.

---

## User & roles

Users are identified by the Hanko subject (`sub` claim in the JWT, a UUID stored as `text`). `hooks.server.ts` verifies the claims on every request (local crypto, no DB) and exposes `locals.getUser()`, which JIT-provisions the row via `getOrCreateUser` only when a route asks for it (memoised per request). Public pages never call it.

**Client shape:** the only user object that reaches the browser is `PublicUser` (`$lib/media/types/user.ts`: `username`, `avatarKey`, `role`, `displayName`), built by `toPublicUser` in `user-queries.ts`. `displayName` falls back username → email local-part → `"Account"` on the server, so the email stays server-side except on `/user/profile`. Loads never return a `UserRow`.

**Role enum (`user_role`):** `user` | `moderator` | `administrator`. Default `user`. Authorization always reads the DB role through `requireRole` (`$lib/server/auth/guards.ts`) — Hanko has no concept of MIDB roles. Promote via `bun run db:seed:admin <email>`.

**Profile fields:** `username` (varchar 32, case-insensitive unique via `lower(username)` index, validated `^[a-z0-9_]{3,32}$` + reserved-name blocklist), `avatar_key` (varchar 48, validated against avatar registry), `email` (nullable — Hanko's claim shape varies by tenant version; `emailFromClaims` handles both string and `{ address }` object forms).

**`getOrCreateUser`** reads first: `SELECT` by id; on a hit it returns the row, and `UPDATE`s `email` only when the stored value is null and the claim has one. On a miss it runs `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *`, then re-`SELECT`s if a concurrent first request won. Steady state is one primary-key read and zero writes. It never bumps `updated_at`; that column is only set in `updateProfile` for real edits.

---

## Database schema

The active schema spans `db/schema/titles.ts`, `sources.ts`, `auth.ts` and `community.ts`, with shared column sets in `columns.ts`. The barrel `db/schema/index.ts` re-exports every file, and `createDb` (`db/client.ts`) and `db/test/reset.ts` rely on it.

> The old user-evaluation model (`metrics`, `metric_options`, `evaluations`, `evaluation_results`) is gone: `db/schema/metric.ts` has been **deleted** and the migrations were **squashed** (2026-06-05), so the current `0000` baseline simply never creates those tables. (Historically they were dropped in the old migration `0006`, which no longer exists on disk.)

**Conventions (remediation PR 4):** every timestamp is `timestamptz`; tables with `created_at`/`updated_at` use `timestamps()` from `columns.ts`, whose `$onUpdate` bumps `updated_at` on every Drizzle update (pin it with ``updatedAt: sql`${col}` `` when a write must not count as an edit). The nine UM flag columns are defined once in `umFlagColumns()`. There are no `0` sentinels: unknown years and missing ids are `NULL`.

### Tables (active)

**`titles`** (`titles.ts`) — the spine for movies **and** TV; seeded from the Bechdel CSV, ids backfilled from TMDB.

- `id` uuid PK, `kind` enum `title_kind` (`movie`|`tv`) NOT NULL, `tmdb_id` integer nullable, `imdb_id` varchar nullable **unique**, `title` varchar(255), `clean_title` varchar(255) (output of `normalizeTitle()`, the UM match key), `year` integer nullable (**NULL = unknown**), `created_at`, `updated_at`.
- **Unique index `titles_kind_tmdb_idx` on `(kind, tmdb_id)`**: the natural key, because TMDB movie and TV ids share a numeric space (movie 1399 and TV 1399 coexist). Postgres treats NULLs as distinct, so seeded rows without a TMDB id coexist. IMDb ids are globally unique across movies and series, so `imdb_id` has a plain unique.

**`title_bechdel`** (`sources.ts`) — seeded, **1:1 with a title**.

- `title_id` uuid **PK** → `titles.id` (cascade), `bechdel_id` integer, `rating` smallint (**CHECK 0..3**), `num_votes` integer, `created_at`.

**`um_source`** (`sources.ts`) — spine-independent **UM catalogue**; every movie and TV row from the UM CSV.

- `um_id` integer **PK**, `clean_name` varchar, `clean_title_key` varchar (year-stripped normalized key, the lookup index), `year` integer nullable (NULL = unknown), the 9 flag columns (`umFlagColumns()`), `comment` text.
- **B-tree index `um_source_clean_title_key_idx` on `clean_title_key`** — `getUnconsentingCandidates` queries this column on every media page with no seeded UM binding (the common case); without the index that's a full table scan.
- Populated by `db:seed:um` for **all** UM movie/TV rows regardless of whether a title matches. Enables runtime candidate lookup without re-parsing the CSV.

**`title_um`** (`sources.ts`) — seeded, **1:1 with a title**; the resolved UM binding, **by reference only**.

- `title_id` uuid **PK** → `titles.id` (cascade), `um_id` integer → `um_source.um_id`, `created_at`.
- The flags are read through the join (`getUmEntry`), so a UM reseed is reflected immediately and there is one row shape (`UmEntry`). Matched by `clean_title` at seed time using a year-aware policy (see Seeding). User choices are never persisted (see UM Disambiguation below).

**`user`** (`auth.ts`) — Hanko-sub PK. `id` text (Hanko `sub`), `email` nullable, `role` enum `user_role` default `user`, `username` varchar(32) nullable, `avatar_key` varchar(48) nullable, `timestamps()`. Unique index on `lower(username)` (case-insensitive, NULLs don't collide). Index on `role`.

**Community tables** (`community.ts`) — empty; one table per metric shape so each can hold what it names. No write path yet (see Known gaps).

- **`community_bechdel_ratings`**: `user_id` → `user.id` (cascade), `title_id` → `titles.id` (cascade), `rating` smallint (**CHECK 0..3**, `cbr_rating_range`), `timestamps()`. PK `(user_id, title_id)` (resubmit = upsert), index `cbr_title_idx (title_id)`.
- **`community_um_reports`**: `user_id`, `title_id` (both cascade), the 9 flag columns as explicit booleans (`umFlagColumns()`, same shape as `um_source`, aggregatable as `avg(col::int)`), `timestamps()`. PK `(user_id, title_id)`, index `cur_title_idx (title_id)`.
- **`community_ddd_votes`**: `id` uuid PK, `user_id`, `title_id` (both cascade), `topic_id` integer, `season`/`episode` integer nullable (NULL = whole title), `yes` boolean, `timestamps()`. Constraint `cdv_vote_uniq UNIQUE NULLS NOT DISTINCT (user_id, title_id, topic_id, season, episode)` (PG ≥ 15; compose and CI run 16), index `cdv_title_topic_idx (title_id, topic_id)`.
- **`comments`**: `id` uuid PK, `title_id` → `titles.id` (cascade), `user_id` → `user.id` (cascade), `body` text (**CHECK `char_length(body) BETWEEN 1 AND 5000`**), `status` enum `comment_status` (`visible`|`hidden`|`deleted`, default `visible`), `timestamps()`. Indexes `(title_id, created_at)` for the title thread, `(user_id, created_at)` for history. No `parent_id` yet: threads are an additive migration when designed.

### Migrations

**Squashed to a single baseline (2026-06-05).** The prior chain (`0000`–`0008`) had corrupted drizzle metadata — `meta/` was missing the `0007`/`0008` snapshots (a legacy of hand-merged duplicate `0002_*` files), which made `db:generate` emit broken diffs (re-creating `um_source`, dropping already-handled tables). Since the dev DB is disposable, the entire `migrations/` folder (SQL + meta) was deleted and regenerated into one clean baseline:

- **`0000_jazzy_tag`** — the full current schema: `movies`, `movie_bechdel`, `um_source` (incl. `um_source_clean_title_key_idx`), `movie_unconsenting`, `movie_trigger_tags`, `user`.

- **`0001_swift_wolverine`** (generated 2026-10-24, remediation PR 3) — `user_role` + `metric_kind` enums; `user` rewritten in place (every new column answered _create_, so the Auth.js `name`/`emailVerified`/`image` columns are dropped, `email` becomes nullable, `role`/`username`/`avatar_key`/`created_at`/`updated_at` added, `lower(username)` unique idx + `role` idx); `movie_trigger_tags.created_by` FK re-created with `ON DELETE SET NULL`; `community_metric_submissions` + `comments` with all indexes. Auth.js-era `user` rows are not deleted (drizzle-kit prompts per column, not per table); their ids are not Hanko subs, so nothing ever matches them.

- **`0002_titles_spine`** (generated 2026-10-24, remediation PR 4) — answers: _rename_ `movies`→`titles`, `movie_bechdel`→`title_bechdel`, `movie_id`→`title_id` (in `comments` and `title_bechdel`); _create_ for everything else (`title_kind`/`comment_status` enums, `title_um`, the three community tables, `comments.status`). Drops `community_metric_submissions`, `movie_trigger_tags`, `movie_unconsenting` and the `metric_kind` enum; drops `movies.tmdb_id`'s unique in favour of `titles_kind_tmdb_idx`; every timestamp becomes `timestamptz`. **Hand-edited SQL** (snapshot untouched): `USING … AT TIME ZONE 'UTC'` on each `timestamp → timestamptz`; `kind` added with a temporary `DEFAULT 'movie'` that the data block drops; a data block (unpack `tmdb-tv:<id>`/`tmdb:<id>` into `kind`/`tmdb_id` with `imdb_id` NULL, `year <= 0` → NULL in `titles` and `um_source`, copy `movie_unconsenting` bindings into `title_um`) placed after the renames and column changes and before `DROP TABLE movie_unconsenting` and the new unique/check constraints. Not reversible by revert: roll back by restoring a `pg_dump`. drizzle-kit 0.31.10/0.31.11 crash when one `generate` both renames a table and alters its columns (`preparePgAlterColumns` reads the old snapshot under the new table name); the snapshot was generated with that one lookup made optional-chained in the local `node_modules` (it only decides whether the old column type was an enum, and none were), then the stock package was reinstalled and the drift check confirmed clean.

Future schema changes append `0003`, `0004`, … and **commit the generated SQL, snapshot and journal in the same PR as the schema change.** CI's `migrations` job runs `drizzle-kit generate --name drift_check` and fails if `db/migrations` changes. Never hand-write or hand-edit a snapshot JSON. `db:generate` prompts (rename vs create) need a TTY; without one, run it as `script -qec "bunx drizzle-kit generate" /dev/null` and answer the prompts.

**Boot does NOT auto-migrate** (commit `742c612`). Run `bun run db:migrate` explicitly after `bun run db:generate`. A fresh DB migrated from zero matches the schema; the CI `db` job proves it on every run.

---

## Seeding

Raw CSVs in `db/seeds/sources/`. Scripts run under Bun and use `csv-parse` for streaming. Each seeder exports its core as a function taking `(db, csvPath)` (the DB smoke test calls it with the test client and the 50-row fixtures in `db/test/fixtures/`); the `bun` entry point (`if (import.meta.main)`) imports `db` + `closeDb` from `db/scripts/lib/db.ts` (built from `process.env.DB_CONNECTION`, which Bun loads from `.env`; throws if unset) and closes the pool when done. All upserts are idempotent (`onConflictDoUpdate`).

1. **`db:seed:movies`** (`seedMovies.ts`) — stream the **Bechdel CSV** → upsert `titles` (`kind: 'movie'`, keyed by `imdb_id`) + `title_bechdel`. Source of `imdb_id`, `title`, `year` (non-positive → NULL), `clean_title`.
2. **`db:seed:um`** (`seedUnconsenting.ts`) — stream the **UM CSV**:
   - Populates **`um_source`** for every movie and TV row (idempotent, regardless of match outcome).
   - Derives a `(titleKey, umYear)` pair per row using **`stripTrailingYear`** (UM's `cleanNameArticles` often embeds the year: `"wuthering heights 2026"`); UM's `yearOfRelease = 0` becomes NULL.
   - Matches movie rows to movie `titles` by **year-aware policy**: (1) only one movie with this title → bind (unambiguous); (2) several same-title movies → bind the exact `(titleKey, umYear)` hit; (3) several, no year hit → leave unmatched (`ambiguous` in report). Writes only `(title_id, um_id)` into `title_um`. Unmatched rows go to the report (`unconsenting_unmatched.txt` by default; the third argument overrides it, which the smoke test uses). TV rows are never bound at seed time; the runtime picker covers them.
   - Does **not** create `titles` rows from UM data.
3. **`db:backfill:tmdb`** (`backfillTmdb.ts`) — resolve null `tmdb_id` on **movie** titles with an IMDb id via TMDB `/find/{imdb_id}`. `getOrCreateTitleRow` will also backfill once a write endpoint uses it.

**`db/lib/normalizeTitle.ts`** — two exports (the app imports it as `$db/lib/normalizeTitle`, the seeders relatively, so the matching key is one module):

- `normalizeTitle(title)` — lowercase, strip leading articles (en/fr/de/es/it), strip diacritics + punctuation, collapse whitespace. Must mirror UM's `cleanName` conventions.
- `stripTrailingYear(normalized)` — removes a trailing ` (19|20)\d\d` from an already-normalized string, returns `{ key, year }`. Used to handle the ~12% of UM rows whose `cleanNameArticles` embeds the year.

Both are covered by unit specs (`db/lib/__tests__/normalizeTitle.spec.ts`).

Run order matters: **`db:seed:movies` must run before `db:seed:um`** so the `titles` spine is populated before UM tries to bind to it. Re-running either is safe. `db:seed:um` rewrites `db/seeds/sources/unconsenting_unmatched.txt`; don't commit seed-run changes to it.

---

## Detail pages (`src/routes/movie/[movieId]/`, `src/routes/tv/[seriesId]/`)

The flagship pages. Server-rendered for DB metrics, **streamed** for the live DDD call. Movies and series share one loader (`loadTitle`) and one client page-state class (`TitleView`); they differ only in which TMDB call runs and which metrics apply.

**Server (`+page.server.ts`, both pages):**

```ts
setHeaders({ 'cache-control': PUBLIC_PAGE }); // $lib/server/http/cache — CDN-cacheable, so never read the user here
return loadTitle('movie', params.movieId); // or loadTitle('tv', params.seriesId)
```

**`$lib/server/titles/load-title.ts`** — `loadTitle(kind, tmdbId)` (overloaded, so the movie page gets `media: Movie` and the TV page `media: Series`):

1. `getMovie` / `getSeries` (TMDB, cached 24 h via `$lib/server/cache`);
2. `getTitleRow(kind, media)` — read-only; `null` if the title was never seeded (GET routes never call `getOrCreateTitleRow`);
3. with a row: `getBechdel` (movie only, `null` for series) and `getUmEntry` in parallel; without one, both `null` and no DB round-trip;
4. no seeded UM binding → `getUnconsentingCandidates(media)`;
5. `getTriggerTagsLive(media.imdbId)` (movie) or `getTriggerTagsForSeries(media)` (tv), returned **un-awaited** so it streams.

Page data on both pages: `{ media, bechdel, umEntry, umCandidates, triggerTags }`.

**DDD live client (`$lib/server/integrations/ddd.ts`):** `getTriggerTagsLive(imdbId)` (movies, imdb lookup) and `getTriggerTagsForSeries(series)` (title text-search + tmdb/year match). Two-step fetch with `X-API-KEY`; results cached 1h via `$lib/server/cache` (keys `ddd:imdb:…` for movies, `ddd:tmdb:…` for series). Returns `TriggerTag[]` filtered to `yesSum >= noSum && yesSum > 0`, carrying season/episode scoping for series. Unit tests reset it with `clearCache()` from `$lib/server/cache`. Public types (`TriggerTag`, `DddResult`) live in `ddd-types.ts` — `ddd.ts` re-exports them; `media/types/ddd.ts` imports from `ddd-types` directly so type consumers never transitively load the client.

**Client page state (`$lib/media/utils/titleView.svelte.ts`):** `new TitleView(() => data, kind)` in the page script. All `$derived` over the load data:

- `media`, `umCandidates`; `selectedUm` (writable `$derived` keyed on `media.id`: a pick overrides it, a title change resets it, no effect); `umData = umEntry ?? lone candidate ?? selectedUm`; `hasUmCandidates`; `flagCount` (`umFlagCount`);
- `ddd` — `createDddState(() => data.triggerTags, isSeries).current`, `null` while streaming;
- `visibleTags` — all DDD tags on movies, `episodes.visibleTags` on TV;
- `safety` (`scoreSafety(umData, ddd)`; on TV over the episode-filtered tags) and `representation` (`scoreRepresentation`, Bechdel ignored for series);
- `episodes` — an `EpisodeFilter` (`$lib/media/utils/episodeFilter.svelte.ts`) on TV, `null` on movies: writable `season` / `episode` (reset on title change), `select(season, episode)`, `visibleTags` via the pure `filterTagsByEpisode` (series-level `-1` tags always; unscoped `null` tags only with no season picked).

Both `+page.svelte` files keep only markup and their own sections: the Bechdel criteria ladder (and its `.criterion-*` styles) on movies, the `DddEpisodeSelector` snippet on TV.

**Page (`+page.svelte`) — rendered structure:**

- **`#details` header** (`movies/facts/detailHeader.svelte`): poster + title + year/runtime meta + **two-axis verdict panel** + **metric summary chips** + **fact grid** (`factGrid` for movies, `seriesFactGrid` for series). The header accepts two optional snippets: `verdict` (rendered between the year meta and the chips) and `children` (the chips + fact grid).
- **Two-axis verdict panel** — `movies/facts/verdictPanel.svelte` + `movies/facts/verdictCard.svelte`: renders a Content Safety card and a Women's Representation card. Each card shows a clean label + summary on first render; hovering/focusing (desktop) reveals a named-signal breakdown popover, tapping (touch) expands it inline — reusing the `dddTags.svelte` dual hover+tap pattern. Each card is a focusable `<button>` with `aria-expanded`; the popover is a `position:absolute` tooltip anchored to the card bottom. Safety reacts to DDD arrival because it's `$derived`; the card shows "updating…" with `aria-busy` while DDD is null. Zero layout shift: both cards always render from first paint.
- **Metric summary chips** — `movies/facts/metricChip.svelte`: one chip per metric, renders as `<a>` when `href` is given (navigates to section anchor), static `<div>` otherwise (series Bechdel N/A). The UM chip's pulsing `--accent-bg` badge is shown via `badgeCount` prop when candidates are available. Value content passed as a snippet.
- **Collapsible metric sections** — Bechdel stays inline per page; UM section is `movies/metrics/umMetricSection.svelte`; DDD section is `movies/metrics/dddMetricSection.svelte` (accepts a `selector` snippet so the series page injects the `DddEpisodeSelector` without the component knowing about seasons).
- **`#gender` section** — plain `<section>` outside the collapsible stack: `movies/facts/genderDistribution.svelte` stacked bar + legend. Men use `--seg-male` (lilac light / gold dark).
- **DDD streaming** — `createDddState(() => data.triggerTags, isSeries)` from `$lib/media/utils/dddStream.svelte.ts` wraps the cancellation-guarded `$effect`; `TitleView` owns it and both pages read `view.ddd`.
- **Comments skeleton** — `movies/sections/commentsSkeleton.svelte` (shared, identical across both pages).

**`$lib/server/data/title-queries.ts`** — identity resolution:

- `getTitleRow(kind, ref)` — **read-only**. Tries `(kind, tmdb_id)` → `(kind, imdb_id)`; returns the row or `null`. Used on GET routes so page visits never mutate the DB.
- `getOrCreateTitleRow(kind, ref)` — **write path**. Same lookup, then a race-safe insert on a miss (`ON CONFLICT DO NOTHING RETURNING`, then read again), then a backfill of whichever id was null (skipped if another row owns it). Reserved for future write endpoints (community ratings, comments) that need a guaranteed `titles.id` FK target; no GET route calls it.
- `TitleRef` is the structural `{ title, imdbId, tmdbId, releaseDate }` that both `Movie` and `Series` satisfy. Unknown release dates give a NULL year.

**`$lib/server/data/sources.ts`** — seeded metric reads:

- `getBechdel(titleId)` — `title_bechdel` row or `null`.
- `getUmEntry(titleId)` — joins `title_um` → `um_source`, returns `UmEntry | null`.
- `toUmEntry(row)` — the single `um_source` → `UmEntry` mapper, also used by `um-candidates.ts`.

**`$lib/server/data/um-candidates.ts`** — UM disambiguation algorithm:

- `getUnconsentingCandidates(ref)` — queries `um_source` by `cleanTitleKey` (plus the singular/plural alternate); applies year-aware filtering (see UM Disambiguation); returns full `UmEntry`s so a picked candidate renders identically to a seeded binding.

---

## UM Disambiguation

UM is the only source with no `imdb_id`, matched purely by normalized title. When a title has no seeded `title_um` binding, `getUnconsentingCandidates` resolves candidates from `um_source`:

| Title year known?          | Candidates                   | Outcome                                                                                                                     |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Yes                        | Exact year match found       | Return that one candidate → **rendered directly, no picker** (auto-match)                                                   |
| Yes                        | No candidate shares the year | Return the unknown-year (`year IS NULL`) entries, up to 5 (one → auto-match, several → picker); none → `[]` → **"No data"** |
| Unknown (no `releaseDate`) | Any                          | Return up to 5 candidates → **picker shown** (one → auto-match)                                                             |

**Nothing is persisted.** A user's pick lives only for the current page view — `TitleView.selectedUm` is a writable `$derived` keyed on `media.id`, so it resets on every title change. `TitleView` derives `umData = umEntry ?? autoUm ?? selectedUm`; the chip, section header, and flag list all read from `umData` so a picked candidate renders identically to a seeded binding.

**Why `um_source` exists:** `title_um` is a binding, keyed by `title_id`, so it only covers entries that _already matched_ a spine title. For ambiguous (same title, different year), TV, or spine-absent titles, `um_source` is the durable, re-queryable catalogue that doesn't require re-parsing the CSV per request. Bindings reference it, so both paths read one row shape.

**`UmEntry` type** (in `src/lib/media/utils/metrics.ts`, re-exported from `$lib/media/types/um.ts`) — `umId`, `cleanName`, `year`, `comment` + all 9 flag booleans. Seeded bindings and picked candidates both use it; the concern count is derived with `umFlagCount`, not stored.

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
| `ui/tile/`          | tile, tileGrid                                                                                                                                                                              | Generic tile primitives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ui/feedback/`      | skeleton                                                                                                                                                                                    | Shimmer block. Not rendered by any page today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ui/text/`          | block, tooltip                                                                                                                                                                              | Collapsible HTML block, tooltip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `user/avatars/`     | Avatar, AvatarPicker, avatars.ts, \*Icon.svelte                                                                                                                                             | Avatar system. `avatars.ts` holds only the key → component map (`AVATAR_COMPONENTS`); keys and display names are plain data in `$lib/media/utils/avatars.ts` (`AVATAR_DEFS`, `AVATAR_KEYS`). Six SVG icon components (Wollstonecraft, Pankhurst, Truth, de Beauvoir, Davis, Kahlo). `Avatar.svelte` renders by key; null/unknown → neutral default. `AvatarPicker.svelte` selectable grid (hidden radio + sibling CSS, reuses `radioTile` pattern). `user-queries.ts` validates writes against `AVATAR_KEYS` from the util, so the server data layer pulls in no `.svelte` component. `@reference` depth: `../../../../app.css` (4 levels).                                                                                                                                   |
| `ui/visualization/` | progressbar                                                                                                                                                                                 | Horizontal/vertical progress bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `theme/`            | themeToggle                                                                                                                                                                                 | Light/dark switch; reads localStorage, writes `document.documentElement.dataset.theme`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `layout/`           | navbar, navbarSearch, navbarMenu, navProgress, footer                                                                                                                                       | Global chrome, mounted in root `+layout.svelte`. `navbar` mounts search off `/` and, below `md`, folds Resources/Blog/About into `navbarMenu`. Both read the client session (`session.svelte.ts`), not page data: the navbar's fixed-size auth slot holds Sign in, or the avatar + profile link + logout (plus a Moderation shield icon on md+ for moderator/administrator), with zero layout shift (see _Auth flow_).                                                                                                                                                                                                                                                                                                                                                        |
| `landing/`          | heroSearch                                                                                                                                                                                  | `heroSearch` wraps `search/movieSearch`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `resources/`        | resourceNav, metricArticle, subBlock, bechdelLadderExample, umFlagsExample, verdictTierExample                                                                                              | Building blocks for the static `/resources` explainer. `metricArticle` is an always-open section card (icon + `.display` title with a muted subtitle under it + body, optional external "More info" link) reusing `collapsibleSection`'s surface. `subBlock` is a labelled prose block (What it is / How it works / …). `resourceNav` is the sticky in-page nav with IntersectionObserver active-section highlight. The `*Example` components are static illustrations that **reuse the live marker CSS** — `bechdelLadderExample` copies the `.criterion` ladder, `umFlagsExample` copies the `.um-flag` grid, `verdictTierExample` renders the safety/representation tier legend tinted via `toneTokens`. Two folders deep → `@reference "../../../app.css"` (three `../`). |
| `auth/`             | hankoAuth, hankoProfile, logoutButton                                                                                                                                                       | Hanko web-component wrappers. `logoutButton` awaits `hanko.logout()`, clears the session, then `goto('/auth', { invalidateAll: true })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `movies/facts/`     | detailHeader, factGrid, seriesFactGrid, genderDistribution, **castRepresentation**, **crewRepresentation**, **representationDisclosure**, **metricChip**, **verdictPanel**, **verdictCard** | Header + fact grids (movie vs series) + gender chart + cast/crew breakdown + shared metric chip + two-axis verdict. `detailHeader` gained a `verdict` snippet prop (rendered between year meta and children). `verdictPanel` composes two `verdictCard`s; each reads tone tokens from `verdict.ts` via inline CSS custom props. `castRepresentation`/`crewRepresentation` are the "see more" disclosure bodies under the `#gender` section, wrapped by `representationDisclosure` (a labelled show/hide toggle).                                                                                                                                                                                                                                                              |
| `movies/sections/`  | collapsibleSection, description, **commentsSkeleton**                                                                                                                                       | Section scaffolding. `commentsSkeleton` renders the loading comments section (heading + 4 skeleton rows), shared across movie and series pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `movies/metrics/`   | dddTags, dddEpisodeSelector, **umCandidates**, **umMetricSection**, **dddMetricSection**                                                                                                    | DDD table + episode selector + UM picker + shared metric sections. `umMetricSection` owns the full UM `CollapsibleSection` (flag list, `umCandidates` picker, comment, no-data state). `dddMetricSection` owns the DDD `CollapsibleSection` (skeleton, `DddTags`, no-data); accepts a `selector` snippet so the series page injects `DddEpisodeSelector` without the component knowing about seasons.                                                                                                                                                                                                                                                                                                                                                                         |
| `movies/media/`     | image, tile, description                                                                                                                                                                    | TMDB poster `<img>` + result tile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `search/`           | movieSearch, searchInput, searchResults, searchResult, resultPoster, searchForm (story only) (+ `movieSearch.svelte.ts`, `types.ts`)                                                        | Live inline search (see Live search below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Notable mechanics:

- **`movies/sections/collapsibleSection.svelte`** — native `<details>`/`<summary>` card: rotating chevron, `.display` title, tone-coloured status pill, optional external source link, optional internal `learnHref`/`learnLabel` link to the `/resources` explainer (default label "How this works"), `children` snippet body. Bechdel/UM/DDD all pass `learnHref` so the cross-link is defined once here.
- **`movies/metrics/dddTags.svelte`** — DDD vote table. One **shared** `position: fixed` tooltip for the whole list (avoids per-row CSS hover-gap flicker). Rows with a comment are focusable `<button>`s; tooltip is positioned from the hovered row's rect, flips above/below by available room, dismisses on scroll/resize. Header row (`ddd-header`) labels the Yes/No vote columns in muted `--danger-soft`/`--success-soft` colors. Honors `prefers-reduced-motion`. Types imported from `$lib/media/types/ddd`.
- **`movies/facts/genderDistribution.svelte`** — stacked bar + legend; `total===0` empty state; men use `--seg-male`.
- **`movies/facts/castRepresentation.svelte` / `crewRepresentation.svelte`** — the `#gender` "see more" disclosure bodies. Both render as a **surface card** (`rounded-lg border border-border bg-surface-raised`) with a tinted header (`color-mix(--brand 4%, --surface-raised)`) carrying a gender **legend** (shared `seg-*` swatch classes; `--seg-male` for men), then dividered rows. Cast = Leads/Supporting/Background tiers, each a proportion bar + count chips. Crew = a department/job table with mini-bars; counts render in high-contrast `--ink` (colour identity lives in the bars + header swatches, **not** coloured digits — bright `--accent-bg` as text fails contrast). The `unknown` segment shares the track colour, so it gets an inset edge to stay visible. Wrapped by `representationDisclosure` (labelled show/hide toggle).
- **`movies/facts/metricChip.svelte`** — single summary chip. Owns all `.chip*` styles and the `badge-pulse` keyframe so they're defined once. The page wraps three chips in a `.summary-chips` grid.
- **`movies/metrics/umMetricSection.svelte`** — full UM section including flag rendering and the `umCandidates` picker fallback. Accepts `umData: UmEntry | null`, `umFlagCount`, `umCandidates`, `hasUmCandidates`, `mediaNoun`, and `onselect`. Flag rows use the **shared marker pattern** (above) — keep them in sync with the Bechdel ladder geometry.
- **`movies/metrics/dddMetricSection.svelte`** — full DDD section including loading skeleton. The `selector` snippet prop is empty for movies; the series page renders `DddEpisodeSelector` into it.
- **`$lib/media/utils/dddStream.svelte.ts`** — `createDddState(getPromise, isSeries)` rune factory. Returns `{ current: DddResult | null }`. Internally runs the cancellation-guarded `$effect` that both detail pages previously duplicated. Import with `.js` extension (`dddStream.svelte.js`) per the Svelte 5 runes-module convention.
- **`$lib/media/utils/titleView.svelte.ts`** / **`episodeFilter.svelte.ts`** — the detail pages' shared state (`TitleView`, see _Detail pages_) and the TV season/episode filter. Import with `.js` (`titleView.svelte.js`).
- **`$lib/media/utils/verdict.ts`** — pure, client-safe two-axis scoring. `scoreSafety(umData, ddd)` → `SafetyVerdict`; `scoreRepresentation({cast, crew, castMembers, crewDepartments, bechdel, isSeries})` → `RepVerdict`. Each returns `{ tier, label, summary, signals: VerdictSignal[], signalsPresent, signalsTotal, tone, icon, pending? }`. `VerdictSignal = { label, detail, present, tone? }` carries per-signal human labels and findings for the hover breakdown (e.g. "Rape on screen / Flagged", "Cast — women / 22%"). Summaries are clean one-liners; the detail count is in `signals`, not appended to `summary`. `subTone(score)` maps 0/1/2 sub-scores to danger/warn/success per signal. Exported helpers: `femaleShare`, `leadsFemaleShare`, `directorOrCrewShare`, `toneTokens`, `SAFETY_HARMFUL_FLAGS`, `SAFETY_CAUTION_FLAGS`, `SV_DDD_MATCHERS`. No imports from `$lib/server/**`. Unit-tested in `src/lib/media/utils/__tests__/verdict.spec.ts`.

> **`@reference` depth note:** components now two folders deep under `ui/*` or `movies/*` use `@reference "../../../../app.css"` (four `../`) in their `<style>` blocks; shallower components (e.g. `layout/`, `search/`) keep three. Getting this wrong surfaces as a Tailwind CSS-resolution error in unit tests, not a type error.

---

## Live search (`src/lib/components/search/`)

- **`movieSearch.svelte.ts`** — `MovieSearchState` rune class: `query`, `results`, `activeIndex`, `loading`, `open`. Owns a `DebouncedQuery` (500 ms) over `/api/search`, the keyboard model (Arrow wrap-around, Enter→select, Escape→close), and navigation, which branches on `mediaType` (`resolve('/tv/[seriesId]', …)` vs `resolve('/movie/[movieId]', …)`). `search(q)` clears the previous rows and shows the spinner at once; a blank query closes the panel with no request. An error response (e.g. a 429) or a failed fetch ends in "no results". `connect()` watches navigation, and its teardown cancels a pending query. `optionId(id, mediaType)` builds the stable `aria-activedescendant` ids.
- **`DebouncedQuery`** (`$lib/media/utils/debouncedQuery.svelte.ts`, imported as `debouncedQuery.svelte.js`) — `push(query)` restarts the debounce window and aborts the in-flight `fetch` through its `AbortSignal`; a superseded response is dropped even if it resolves, so a stale result never overwrites a newer one. A blank query delivers the `empty` value at once, with no request; a rejected source also delivers `empty`. `cancel()` drops both. Nothing runs before the first `push`. Also used by the `/user/profile` username availability check (400 ms).
- **Query cap.** `SEARCH_QUERY_MAX_LENGTH = 120` (`$lib/media/utils/search.ts`): `searchInput` and `navbarSearch` set it as `maxlength`, and `/api/search` trims, then truncates anything longer (truncate, not reject).
- **`movieSearch.svelte`** — orchestrator: instantiates state, wires `$effect(() => search.connect())`, click-outside dismiss, composes child components. Its listbox id comes from `$props.id()` (same on server and client). Import uses **`.js` extension** (`./movieSearch.svelte.js`) so Vite resolves the `.svelte.ts` module, not the component. Mounted on the landing hero (`landing/heroSearch.svelte`).
- **Two independent consumers of `MovieSearchState`.** The landing hero uses the full `movieSearch.svelte` (bordered input + submit button via `searchInput`). The global navbar uses `layout/navbarSearch.svelte` — a separate, minimalistic consumer that reuses `MovieSearchState` + `searchResults` directly with its own compact, collapse-by-default field (no submit button). Each consumer instantiates its own `MovieSearchState`; the navbar one only mounts on non-landing routes (`pathname !== '/'`).
- Panel visibility is `open && query.trim()` — `close()` flips `open` but preserves `query`/`results` so re-focus re-shows prior results without refetch.

---

## Server cache (`src/lib/server/cache/`)

A single swappable cache fronts every external call so repeat detail-page visits skip the round-trip that dominates latency.

- **API.** `getCached<T>(key, ttlMs, fetcher)` — returns the cached value or runs `fetcher`, stores it, and returns it. A fetcher that throws stores nothing. Backend failures degrade to a cache miss (the fetcher still runs), so caching can never make a request fail — only slower. `clearCache()` (values and counters) is exposed for tests.
- **Counters.** `incr(key, ttlMs)` adds 1 to a fixed-window counter and returns the count; the window starts on the first hit and the count starts over when it ends. Memory: a separate `Map` (`MAX_COUNTERS = 10_000`, oldest window dropped first), so counters and cached values never evict each other. Redis: `INCR`, plus `PEXPIRE` on the first hit. A Redis error returns 0 (fail open). Backs `rateLimit` (see _Caching policy_).
- **Backend selection** is a deploy-time decision via one env var, not a code change:
  - **No `REDIS_URL`** → bounded in-process LRU (`MAX_ENTRIES = 500`, TTL'd, insertion-order eviction with read-touch). Persists for the process lifetime — right for a single long-lived Node server.
  - **`REDIS_URL` set** → Redis backend. The `redis` package is an **optional dependency**, imported lazily (`await import(/* @vite-ignore */ 'redis')`) so the app builds and runs without it installed; the `@vite-ignore` stops Vite from failing the build when it's absent.
- **Keys** are namespaced: `tmdb:movie:v2:<id>`, `tmdb:series:v2:<id>` (24h TTL); `tmdb:search:v1:<lowercased query>` (10 min); `ddd:imdb:<id>`, `ddd:tmdb:<id>` (1h TTL); counters `rl:<bucket>:ip:<address>` / `rl:<bucket>:user:<id>`. Search entries share the 500-entry LRU with title entries, so heavy search traffic can push detail pages out of an instance's memory sooner (Redis has no such cap).
- **Why Redis is optional:** on a single Node process the in-memory cache already survives between requests. Redis earns its place only to share the cache across instances or survive restarts/deploys (and on ephemeral serverless). See _Configuration & environment_ for the opt-in setup.

---

## TMDB integration

One module, `$lib/server/integrations/tmdb/` (server-only: it holds `TMDB_API_TOKEN`):

- **`client.ts`** — `tmdbFetch<T>(path, params)`: `PUBLIC_TMDB_API_URL` + path, `Authorization: Bearer` + `accept: application/json`, params as the query string; a non-OK response throws SvelteKit `error(status, 'TMDB error: …')`. `tmdbCached(key, fetcher)` is `getCached` with the 24 h `TMDB_TTL_MS`.
- **`mappers.ts`** — pure, no fetch or env: `aggregateGender` (0/1/2/3 → unknown/female/male/nonBinary), `genderCategory`, `buildCastMembers` (billing order), `buildCrewDepartments` (priority departments first, from `$lib/media/utils/departments.ts`, then by headcount), `mapMediaDetail(data, kind)` (the shared `MediaDetail` fields; movie reads `title`/`release_date`/`external_ids.imdb_id ?? imdb_id`, tv reads `name`/`first_air_date`/`external_ids.imdb_id`), `mapMovie`, `mapSeries` (adds seasons/networks/created-by), `mapSearchResults` (movie + tv hits only). Also the raw `Tmdb*Response` types.
- **`index.ts`** — `getMovie(id)` and `getSeries(id)` (`append_to_response=credits,external_ids`, `language=en-US`; cache keys `tmdb:movie:v2:<id>` / `tmdb:series:v2:<id>`, 24 h, unchanged by the PR 5 move because the mapped shape is unchanged), `searchTitles(q)` (`search/multi`; `getCached('tmdb:search:v1:' + q.toLowerCase(), TMDB_SEARCH_TTL_MS)`, 10 min, the TTL beside `TMDB_TTL_MS` in `client.ts`). A TMDB error status throws out of the fetcher, so nothing is cached and the next search retries; `/api/search` answers it with an uncached `{ results: [] }`. `SearchResult` is shared with the client via `$lib/components/search/types`.
- **Tests** (`tmdb/__tests__/`): `mappers.spec.ts` against trimmed TMDB payloads in `fixtures/` (`movie-603.json`, `tv-1399.json`, `search-matrix.json`) plus a snapshot of the mapped movie and series; `client.spec.ts` (headers, error mapping, caching; search cache: case-insensitive hit, distinct queries, error not cached, 10 min expiry) with a stubbed `fetch`.
- **`movies/media/image.svelte`** — responsive `srcset` from `PUBLIC_TMDB_IMAGE_URL`; `src` defaults to `w500`. `search/resultPoster.svelte` builds a fixed `w92` URL directly (keeps the 20-row search list cheap).

---

## Auth flow (Hanko)

1. `/auth` renders `<hanko-auth>` → success event → `goto("/user/profile")`.
2. Hanko sets a `hanko` JWT cookie from JS (not httpOnly).
3. `hooks.server.ts` calls `verifyClaims` (`$lib/server/auth/hanko.ts`: **module-level** `createRemoteJWKSet`, created once so `jose` caches the JWKS) and sets `locals.claims` (payload or `null`). No DB access here.
4. `locals.getUser()` is lazy and memoised per request: on first call it runs `getOrCreateUser({ sub, email: emailFromClaims(claims) })` (`emailFromClaims` handles `string` and `{ address }` claim shapes); without claims it resolves `null`. Only `/api/me`, `/user/*` loads/actions/endpoints and the moderation gate call it.
5. The hook gates `/user` and `/user/*` (not `/users…` or `/username`) on **claims only**: no claims → `redirect(303, "/auth")`. `/user/moderation*` additionally awaits `requireRole(locals, ['moderator', 'administrator'], { page: true })` → `error(403)` for other roles.
6. **Guards** (`$lib/server/auth/guards.ts`): `requireUser(locals, { page? })` returns the `UserRow` or throws (`redirect(303, '/auth')` for page loads, `error(401)` otherwise); `requireRole(locals, roles, { page? })` adds `error(403)`. Every `/user/*` load, action and endpoint calls one; nothing reads a user off `locals` directly. Future form actions on public pages (e.g. `/movie/:id?/rate`) are not under the `/user` prefix, so the guard is their only check.
7. **SSR is user-agnostic.** There is no root `+layout.server.ts`; public pages carry no user data and are CDN-cacheable (see _Caching policy_). The `/user` layout returns `{ me: PublicUser }` with `private, no-store`.
8. **Client session** (`$lib/media/utils/session.svelte.ts`, imported as `session.svelte.js`): a module singleton with `status: 'pending' | 'anon' | 'user'`, `user: PublicUser | null`, and `hint`. The navbar calls `session.load()` on mount (root layout, so once per full page load; client navigations reuse it), which first sets `hint` from `document.cookie` containing `hanko=` and then fetches `/api/me`. The fetch is skipped when the session is already resolved (a full load of a `/user/*` page sets it from layout data first). `session.set(me)` comes from the `/user` layout data; `session.clear()` from logout. `set`/`clear` invalidate an in-flight fetch so a stale response cannot overwrite them. Writes are browser-only (the singleton would otherwise be shared across SSR requests); `hint` stays null through hydration so server and client markup match.
9. **Navbar auth slot** (`navbar.svelte`): a fixed-size box (`10.5rem × 1.75rem`, `5.5rem` below 480px) with `aria-busy` while pending. SSR renders it empty; it then shows a placeholder from the hint (avatar circle, or "Sign in"), then the resolved state: "Sign in", or [moderation shield icon (md+ only)] + avatar + truncated `displayName` + Logout. Nothing outside the slot moves (zero layout shift); content fades in with the shared `0.15s ease`, disabled under `prefers-reduced-motion`. `navbarMenu.svelte` reads the same session (`likelyUser`, role for the Moderation item). The moderation link is a convenience; authorization stays server-side.
10. `/user/profile` — profile view/edit (avatar + username). `/user/dashboard` — Hanko `<hanko-profile>` (account settings, `ssr=false`). `/user/comments`, `/user/metrics` — history views.
11. `logoutButton.svelte`: `await hanko.logout()` → `session.clear()` → `goto('/auth', { invalidateAll: true })`, so the cookie is gone before any load re-runs.

### Caching policy

- `$lib/server/http/cache.ts` holds the policies as constants, so they are greppable. `PUBLIC_PAGE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'` is set by the `/`, `/resources`, `/movie/[movieId]` and `/tv/[seriesId]` loads; it applies to both the HTML and `__data.json`.
- **Rule:** a load that sets `PUBLIC_PAGE` must not depend on the request's user (no `locals.getUser()`, no `locals.claims`). The Vercel edge cache key ignores cookies, so anything user-specific would be served to every visitor.
- `PUBLIC_SEARCH = 'public, max-age=60, s-maxage=600'` is set by `/api/search` on a successful result: the response is user-agnostic, so the CDN absorbs repeated queries for 10 minutes (matching the server-side search cache) and the browser for 1. An error answer (TMDB down, network failure) and a 429 carry no `cache-control`, so no cache holds them.
- `PRIVATE_NO_STORE = 'private, no-store'` covers personalised responses: `/api/me` and every `/user/*` page (set in the `/user` layout).
- **Rate limiting** (`$lib/server/http/rate-limit.ts`): `rateLimit(event, bucket, limit, windowMs, { userId? })` counts with the cache's `incr` and throws `error(429)` past `limit` in a fixed window. It keys on `userId` when the route already has the user (after `requireUser`), else on `event.getClientAddress()`, and never reads the user itself, so CDN-cached routes stay user-agnostic. Applied to `/api/search` (60/min per IP, after the empty-query short-circuit) and `/user/profile/availability` (30/min per user). Without `REDIS_URL` the counters are per instance (best effort on serverless: each instance counts separately and a cold start resets it); `REDIS_URL` makes the limit global. A Redis error lets the request through.
- User-specific bits on a public page (e.g. a future "your rating") go in a separate uncached fetch, the same way the navbar uses `/api/me`.

---

## Configuration & environment

| Var                     | Used by                                                 | Notes                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DB_CONNECTION`         | `$lib/server/db.ts`, `db/scripts/lib/db.ts`             | Postgres URL, read at **runtime** (`$env/dynamic/private`) on first DB use; unset → clear error, no fallback. Local: the compose DB                                                        |
| `TEST_DB_CONNECTION`    | `db/test/global-setup.ts`, `$lib/server/db.ts`          | **Tests only.** Separate DB (`midb_test` on the compose server) that `test:db` wipes and migrates. Used instead of `DB_CONNECTION` under Vitest                                            |
| `PUBLIC_HANKO_API_URL`  | `$lib/server/auth/hanko.ts` + auth components           | Hanko Cloud tenant URL                                                                                                                                                                     |
| `PUBLIC_TMDB_API_URL`   | `$lib/server/integrations/tmdb/client.ts`               | `https://api.themoviedb.org`                                                                                                                                                               |
| `PUBLIC_TMDB_IMAGE_URL` | image component                                         | `https://image.tmdb.org/t/p`                                                                                                                                                               |
| `TMDB_API_TOKEN`        | `$lib/server/integrations/tmdb/client.ts` (server only) | v4 Bearer token. `$env/static/private`.                                                                                                                                                    |
| `DDD_API_KEY`           | `$lib/server/integrations/ddd.ts` (server only)         | Does The Dog Die API key, `X-API-KEY` header.                                                                                                                                              |
| `REDIS_URL`             | `$lib/server/cache` (server only)                       | **Optional.** When set, the cache and the rate-limit counters use Redis instead of process memory (so the limit is global). Requires the optional `redis` package. `$env/dynamic/private`. |

Nothing is inlined at build time: `vite.config.ts` has no `define`, so `build` and `check` need no database and the server bundle contains no connection string. `.env.example` is the committed template (allow-listed in `.gitignore`) and lists every variable above. Its placeholders are valid enough for `bun run check` and `bun run build`, so a fresh clone and CI only need `cp .env.example .env`. Title pages need real `TMDB_API_TOKEN`/`DDD_API_KEY` values, and sign-in needs a real Hanko tenant.

**One package manager.** Bun 1.4.4 locally, in CI and on Vercel: `package.json` declares `"packageManager": "bun@1.4.4"`, and `vercel.json` sets `installCommand: bun install --frozen-lockfile` and `buildCommand: bun run build`, so production installs exactly the `bun.lock` that CI tested. The old `npm install --legacy-peer-deps` was hiding a real peer conflict (Storybook 9 peers on Vite ≤7 and vite-plugin-svelte ≤6), fixed by moving to Storybook 10.6. `vite` still lists `yaml@^2` as an optional peer while `eslint-plugin-svelte` pulls `yaml@1` via `postcss-load-config`; Bun does not fail on that and nothing loads a YAML config. No dependency is pinned to `latest`.

### Local run sequence

```bash
bun install
cp .env.example .env     # DB_CONNECTION already points at the compose DB
docker compose up -d db  # postgres:16, DB midb on localhost:5432
bun run db:migrate
bun run db:seed:movies   # must run before db:seed:um
bun run db:seed:um
bun run db:backfill:tmdb # optional: resolve tmdb_id ahead of time
bun run dev

# DB tests (once): a separate database on the same server
docker compose exec db createdb -U postgres midb_test
bun run test:db          # wipes midb_test, migrates it from zero, runs *.db.spec.ts
```

### npm scripts

`dev` / `build` / `preview` · `check` · `test` = `test:integration` + `test:unit` · `test:unit` = `vitest --project unit` (no DB) · `test:db` = `vitest run --project db` (needs `TEST_DB_CONNECTION`) · `lint` / `format` · `storybook` / `build-storybook` · `db:generate` · `db:migrate` · `db:seed:movies` · `db:seed:um` · `db:backfill:tmdb` · `db:seed:admin <email>` (case-insensitive promote to administrator).

### CI (`.github/workflows/tests.yml`)

Runs on every PR, on pushes to `main`, and on manual dispatch. Bun is pinned to the local version.

- **`static`**: `bun install --frozen-lockfile` → `cp .env.example .env` (so `$env/static/*` resolves) → `bun run check` → `bun run lint` (`prettier --check .` + `eslint .`) → `bun run build`.
- **`unit`**: `bun install --frozen-lockfile` → `bun run test:unit --run`. Needs no secrets, `.env` or database, because unit specs mock `$env/*` and `$lib/server/db`.
- **`migrations`**: `bunx drizzle-kit generate --name drift_check`, then fails (printing the status and diff) if `git status --porcelain db/migrations` is non-empty. Needs no DB. A drizzle-kit prompt also fails it (no TTY), which is the correct outcome.
- **`db`**: `postgres:16` service with DB `midb_test`, `TEST_DB_CONNECTION` set, then `bun run test:db`. Global setup migrates the empty DB from zero, so this job also proves the migration chain applies cleanly.
- **`e2e`**: skipped unless the repo variable `E2E_ENABLED` is `'true'`. It starts a `postgres:16` service, runs `db:migrate`, then `bun run test:integration`; `playwright.config.ts` builds and previews the app itself (`bun run build && bun run preview`). It needs the secrets `TMDB_API_TOKEN` and `DDD_API_KEY` and the variable `PUBLIC_HANKO_API_URL`. The Playwright report is uploaded on failure.

---

## Known gaps / TODO

1. **Community write path not built** — `community_bechdel_ratings`, `community_um_reports`, `community_ddd_votes` and `comments` exist with their constraints but have no write endpoints (they will resolve titles with `getOrCreateTitleRow`). Empty-state history views are wired at `/user/metrics` and `/user/comments`. The write path (rating submission + comment posting on title detail pages) is the next milestone. DDD stays live and cached; if persistence is ever needed it will be a `ddd_snapshot (title_id, payload jsonb, fetched_at)` cache table, not normalised rows.
2. ~~**Orphaned UI**~~ — closed in remediation PR 6: `processTileGrid` (+ story), `metricsFrame`, `sectionSkeleton`, `landing/topBar` and `navigation/{item,simple}` deleted. Git history is the archive.
3. **UM data is sparse by design** — ~2,858 of ~9,710 spine movies have a UM binding (latest reseed). "No data" is the common, correct state. ~35 title collisions are left as runtime-picker cases (year unknown); ~7,483 have no UM entry at all.
4. **No Storybook stories** for detail-page components (`collapsibleSection`, `dddTags`, `genderDistribution`, `factGrid`, `seriesFactGrid`, `detailHeader`, `umCandidates`).
5. **`movie.tagline`/`overview` mapped but unused** — the header dropped the plot summary in favour of metric chips; both fields stay in the `Movie` shape for potential later use.

> Verification baseline after the `$lib` reorg: `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean.
> Verification baseline after the detail-page refactor (server splits + shared components): same — `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean.
> Verification baseline after the cache layer + startup-migrations + migration squash + dead-seeder removal (2026-06-05): same — `bun run check` → 0 errors, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean. Removed deps: `@loom-io/fs`, `marked` (orphaned with `seed.ts`).
> Verification baseline after user schema + auth flow (2026-06-21): same — `bun run check` → 0 errors/warnings, `bun run test:unit` → 50/50 (7 files), `bun run build` → clean. Migration `0001_*` pending `bun run db:generate` + `bun run db:migrate`.
> Verification baseline after remediation PR 6 (2026-10-25): `bun run check` → 0 errors, `bun run lint` → clean, `bun run test:unit --run` → 238/238 (26 files), `bun run test:db` → 43/43 (6 files), `bun run build` → clean, also with `DB_CONNECTION` unset; `bun install --frozen-lockfile` clean on a fresh clone; drift check clean; `build-storybook` builds (11 stories). Screenshots of `/`, `/movie/603`, `/tv/1399` (light/dark, 375/1280 px), visible text and `__data.json` identical to `main`; `/api/search` bodies identical, only the new `cache-control` differs.
> Verification baseline after remediation PR 5 (2026-10-24): `bun run check` → 0 errors, `bun run lint` → clean, `bun run test:unit --run` → 192/192 (18 files), `bun run test:db` → 43/43 (6 files), `bun run build` → clean, also with `DB_CONNECTION` unset; drift check clean. Screenshots (`/`, `/movie/603`, `/tv/1399`, light/dark, 375/1280 px), visible text and decoded `__data.json` identical to `main` against a local TMDB/DDD fixture stub.
> Verification baseline after remediation PR 4 (2026-10-24): `bun run check` → 0 errors, `bun run lint` → clean, `bun run test:unit` → 155/155 (13 files), `bun run test:db` → 43/43 (6 files), `bun run build` → clean with `DB_CONNECTION` unset. `0002_titles_spine` applied to a seeded `0001` copy and from zero.
> Verification baseline after remediation PR 3 (2026-10-24): `bun run check` → 0 errors, `bun run lint` → clean, `bun run test:unit` → 155/155 (13 files), `bun run test:db` → 14/14 (1 file), `bun run build` → clean with `DB_CONNECTION` unset. Migration `0001_swift_wolverine` generated and applied from zero.

---

## Related docs

- `.CLAUDE/plans/plan-architecture-remediation.md` — 7-PR plan implementing every review finding (session out of SSR, runtime DB config + drift CI, `titles` spine, module consolidation, deps/cleanup, docs). PR 1 (secrets, `.env.example`, formatting, CI `static` job), PR 2 (user-agnostic SSR, `/api/me` + client session, lazy `getUser`, guards, `PublicUser`, `PUBLIC_PAGE`) PR 3 (runtime DB config via `$lib/server/db`, migration `0001` + CI drift check, Vitest `db` project against real Postgres) PR 4 (`titles` spine, UM by reference, per-metric community tables, migration `0002_titles_spine`) and PR 5 (module consolidation) done 2026-10-24; PR 6 (one package manager, deps, cached + rate-limited search, orphans) done 2026-10-25; PR 7 pending.
- `.CLAUDE/plans/plan-architecture-review.md` — architecture review (2026-10-24): P0 fixes (committed secret, CDN-cached personalised HTML, migration drift), proposed `titles` spine + per-metric community tables, and a suggested ordering before the community write path.
- `.CLAUDE/plans/plan-um-matching-fix.md` — the plan that drove the UM matching overhaul (year-aware seeder, `um_source` table, runtime disambiguation picker, `noRape` inversion). Implemented and closed.
- `.CLAUDE/plans/plan-movie-schema-multi-source.md` — the plan that drove the multi-source schema (Bechdel + UM seeding, streamed DDD, page redesign).
- `.CLAUDE/plans/major-version-upgrade.md` — phased dep-upgrade plan.
- `.CLAUDE/plans/plan-a-landing-page.md`, `.CLAUDE/plans/plan-landing-page-search.md` — landing-page and search design notes.
- `.CLAUDE/plans/plan-movie-detail-sections-1-2.md` — **superseded** earlier §1–2 detail-page design; kept for history.
- `.CLAUDE/plans/plan-user-schema-auth-flow.md` — the plan that drove the user schema + auth flow (Hanko-sub PK, JIT provision, roles, avatar system, profile/history routes). Implemented 2026-06-21.
- `README.md` (repo root) — short local setup (Bun + `docker compose`, `.env.example`, migrate + seeds), pointing at `AGENTS.md` and this doc. Rewritten in remediation PR 1; the Auth.js-era vars and the (revoked) SendGrid key are gone.
