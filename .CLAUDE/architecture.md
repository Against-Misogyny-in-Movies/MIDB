# MIDB — Architecture Reference

> Snapshot as of 2026-06-03: landing page + theme toggle shipped, **live inline movie search** wired to a `/api/search` TMDB proxy, and the stack was bumped to **Svelte 5 / Vite 8 / Tailwind 4 (CSS-first) / Storybook 9**. Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for rating and displaying movies through a **diversity lens**. Users log in, find a movie, and evaluate it against structured **metrics** — formal tests for representation. The first (and currently only seeded) metric is the **Bechdel Test**. The design generalizes to many metrics over time.

Movie facts (poster, overview, release date) are **not stored** — they're fetched live from **TMDB** on each request. What *is* stored locally is the diversity evaluation data: who rated which movie against which metric, and which option boxes they checked.

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
| External movie data | **TMDB** REST API v3 (Bearer-token auth) |
| Markdown | `marked` 18 (metric descriptions, pre-rendered at seed time) |
| Testing | Vitest 4 (unit), Playwright (integration), Storybook 9 (component dev) |
| Lint | ESLint 10 (flat config) + `@typescript-eslint/*` 8 + Prettier |

Other notable deps: `nanoid` 5 (element ids), `rxjs` 7.8, `nodemailer` 8; `@faker-js/faker` + `@loom-io/fs` (dev, used by seeding).

---

## High-level data flow

```
                  ┌────────────────────────────────────────────┐
   Browser  ──►   │  SvelteKit server (hooks + load functions)  │
                  └───────────────┬───────────────┬─────────────┘
                                  │               │
                  live fetch ┌────▼─────┐   ┌──────▼──────┐  relational
                   per req.   │  TMDB    │   │  PostgreSQL │  queries
                              │  API v3  │   │  (Drizzle)  │
                              └──────────┘   └─────────────┘
                                  ▲               ▲
                         poster / overview    metrics, options,
                         / release date       evaluations, users

   Auth:  Browser ⇄ Hanko Cloud (web components + JWT cookie)
          hooks.server.ts verifies the `hanko` cookie via remote JWKS
```

- **Entry point** is the landing page at `/` (hero + search UX). The hero search is a **live, inline TMDB search**: typing queries a server proxy (`/api/search`) and renders a results dropdown in place — there is no `/search` page (see Routes & the Live search section).
- **Movie identity** flows by TMDB id through the URL (`/movie/[movieId]`).
- **Metric content** (name, description, options) comes from Postgres.
- **Auth** is entirely Hanko's; the app only verifies the JWT cookie server-side to gate `/user/*`.

---

## Directory layout

```
MIDB/
├── db/                         # Data layer — lives OUTSIDE src/, aliased as $db/*
│   ├── connections.ts          # Drizzle init + migrateDatabase(); exports default db client
│   ├── schema/                 # Drizzle table definitions (drizzle-kit reads ./schema/**/*.ts)
│   │   ├── movie.ts            # movies
│   │   ├── metric.ts           # metrics, metricOptions, evaluations, evaluationResults (+ relations)
│   │   └── auth.ts             # user  (matches the Hanko/Auth.js-era `user` table)
│   ├── scripts/
│   │   ├── migrate.ts          # `bun run db:migrate` → calls migrateDatabase()
│   │   └── seed.ts             # `bun run db:seed`   → upserts metrics from db/seeds/**/*.json
│   ├── seeds/                  # JSON seed data (metrics/*.json; prod/ subdir for production)
│   └── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots
│
├── src/
│   ├── hooks.server.ts         # Auth gate: verifies `hanko` JWT cookie, protects /user/*
│   ├── app.css                 # Tailwind v4 entry + design tokens + @layer components (see Styling)
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── routes/                 # File-based routing (see below)
│   │   └── +layout.svelte      # Svelte-5 root shell: imports app.css + remixicon, {@render children()}
│   └── lib/
│       ├── components/         # Reusable UI, grouped by domain
│       ├── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│       └── stores/             # (debounced.ts)
│
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, dialect/credentials)
├── svelte.config.js            # adapter-auto; alias $db/* → ./db/*; vitePreprocess({ style:false })
├── vite.config.ts              # tailwindcss() + sveltekit() + svelteTesting() + Vitest block
├── tailwind.config.js          # LEGACY Tailwind-v3 file — no longer the theme source (see Styling)
└── .env                        # DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN
```

**Key structural choice:** the database layer (`db/`) sits *outside* `src/`, exposed to the app via the `$db/*` alias defined in `svelte.config.js`. Server-only route modules import `db` from `$db/connections`.

> There is **no `postcss.config.js`** — it was removed in the Tailwind v4 migration; `@tailwindcss/vite` handles CSS directly in the Vite pipeline.

---

## Styling & theming

The styling system is **Tailwind CSS v4, CSS-first**. There is no JS theme config in the build path — the source of truth is `src/app.css`.

- **Entry & tokens.** `app.css` begins with `@import "tailwindcss"`. Build-time design tokens (breakpoints, spacing) are declared in a `@theme { … }` block. Semantic *colors* are exposed to Tailwind utilities through **`@theme inline { --color-*: var(--*) }`** — the `inline` form means the utilities re-resolve their underlying CSS variables at render time, so a theme switch re-cascades without rebuilding.
- **Design-token system.** `app.css` defines raw palette ramps (`--rv-*` purple "revolution", `--aq-*` aqua) and a set of **semantic tokens**: `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--brand`, `--brand-strong`, `--accent`, `--accent-bg`, `--accent-ink`, `--border`, plus status tokens `--secondary`/`--success`/`--warn`/`--danger`/`--info`, each with `-soft` (hover) and `-fg` (on-color text) variants. A `--font-display` (Fraunces) is exposed too.
- **Three theming layers**, in cascade order:
  1. `:root` — light defaults.
  2. `@media (prefers-color-scheme: dark) :root:not([data-theme])` — system dark, applied **only when there is no manual override**.
  3. `:root[data-theme="light"]` / `:root[data-theme="dark"]` — manual overrides set by the theme toggle (writes `document.documentElement.dataset.theme`).
- **Component layer.** `@layer components` styles `body` (`bg-surface text-ink`, `color-scheme: light dark`), `::selection`, `.bg-component`, `h1`/`h2`, `.label`, `.display`.
- **`tailwind.config.js` is a vestigial Tailwind-v3 leftover.** It still defines a colors/spacing/screens theme, but under v4 **it is not read for theming** — do not treat it as the active source of truth. The live tokens are the `@theme` blocks in `app.css`.
- **Svelte `<style>` blocks** use `<style lang="postcss">` with `@reference "…/app.css"` at the top so `@apply` resolves the v4 tokens. `svelte.config.js` sets `vitePreprocess({ style: false })`: this stops vitePreprocess from running its own PostCSS pass (which would resolve a bun-cached Tailwind v3) and hands style processing to `@tailwindcss/vite`, while keeping `lang="postcss"` recognised by svelte-check.

---

## Routes

SvelteKit file-based routing under `src/routes/`. Server-only logic lives in `+page.server.ts` / `*.server.ts` (suffix = never shipped to client). The root `+layout.svelte` is the Svelte-5 shell (`{@render children()}`, imports `app.css` + remixicon, wraps content in `<main class>` with `@apply p-md`).

| Route | Files | Status | Notes |
|---|---|---|---|
| `/` | `+page.svelte`, `+page.server.ts` | **Working (landing)** | Real landing page: `TopBar` (logo + theme toggle + "Sign in"), hero ("Know before you watch."), `HeroSearch` (now a live inline search — see below), a 3-up metrics band, footer. `+page.server.ts` returns `{}`. |
| `/api/search` | `+server.ts`, `datasource.server.ts` | **Working (endpoint)** | `GET ?q=…` proxy to TMDB `search/movie` using the server-only `TMDB_API_TOKEN` (first authenticated TMDB call in the repo). Empty/whitespace `q` short-circuits to `{ results: [] }`; TMDB failures are caught, logged via `console.warn`, and also return `{ results: [] }` (never 500s the UI). Returns a slim `SearchResult[]` shape. No `/search` *page* exists — search is inline-only. |
| `/auth` | `+page.svelte`, `+page.ts`, `+layout.svelte` | Working | Renders Hanko `<hanko-auth>`. On success redirects to `/user/dashboard`. `ssr=false`. Layout centers the widget. |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts` | Working | Fetches movie **live from TMDB** by id (e.g. `/movie/550`). Renders poster, title, date, overview + nav (Metrics works, **Cast goes nowhere**). |
| `/movie/[movieId]/metric` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts` | Working | Lists all metrics from the DB as clickable tiles. **Back-link movie name is hardcoded to "The Matrix"** — known gap. |
| `/movie/[movieId]/metric/[metricId]` | `+page.svelte`, `+page.server.ts`, `datastore.server.ts` | Working | Metric evaluation form. Sequential checkbox UI w/ progress bar (if `hasRelatedOptions`) or plain grid. **`finish`/`failed` submit actions only `console.log` — not persisted to DB yet.** |
| `/user/dashboard` | `+page.svelte`, `+page.ts` | Working (minimal) | Hanko `<hanko-profile>` widget. Auth-gated by `hooks.server.ts`. `ssr=false`. |

> Routing history note: the merge of `feature/add_bechdel_test_page` originally introduced a parallel `/movie/[id]/...` tree that conflicted with `/movie/[movieId]/...`. These were consolidated onto **`[movieId]`** — that is now the single canonical movie param name.

---

## Database schema

Defined in `db/schema/*.ts` (Drizzle). Drizzle's **relational query API** is enabled by passing the combined schema object to `drizzle()` in `db/connections.ts`.

### Tables

**`movies`** (`movie.ts`) — thin cache of movie identity only.
- `id` uuid PK (default random), `title` varchar(255), `tmdbID` integer **unique**, `createdAt`, `updatedAt`.

**`metrics`** (`metric.ts`) — a diversity test definition.
- `id` text PK (e.g. `"bechdel"`), `name`, `shortDescription`, `description` (markdown→HTML), `hasRelatedOptions` boolean (whether options are sequential/dependent), `createdAt`.

**`metric_options`** (`metric.ts`) — the individual criteria of a metric.
- `id` serial PK, `metricId` → `metrics.id` (cascade), `name`, `shortDescription`, `description`, `createdAt`.

**`evaluations`** (`metric.ts`) — one user's rating of one movie against one metric.
- `id` serial PK, `movieId` → `movies.id` (cascade), `metricId` → `metrics.id`, `userId` → `user.id`, `createdAt`, `comment`.
- **Unique index `every_user_once_idx`** on (`movieId`, `metricId`, `userId`) — a user can evaluate a given movie/metric only once.

**`evaluation_results`** (`metric.ts`) — which options were checked in an evaluation (join table).
- Composite PK (`evaluationId`, `metricOptionId`), both FKs cascade.

**`user`** (`auth.ts`) — `id` text PK, `name`, `email`, `emailVerified`, `image`.
- Carried over from the earlier Auth.js setup; `evaluations.userId` references it. (Hanko is the live auth provider; this table predates the switch and is retained for the FK.)

### Relations (Drizzle `relations()`)
- `metrics` → many `metricOptions` (`metricRelations.options`)
- `metricOptions` → one `metrics` (`metricOptionRelations.metric`)

These power the eager-loading queries (`.findFirst({ with: { options: ... } })`).

### Migrations
- Managed by **drizzle-kit**; SQL + snapshots in `db/migrations/`, tracked in `meta/_journal.json`. `drizzle.config.ts` uses `dialect: "postgresql"` and schema glob `./db/schema/**/*.ts`.
- Current chain: `0000_closed_rictor` movies → `0001_bright_tenebrous` (old Auth.js tables) → `0002_wealthy_trauma` (metrics/options/evaluations) → `0003_robust_black_bird` (Bechdel seed data, custom SQL) → `0004_wet_menace` (rename `related_options`→`has_related_options`, NOT NULL tightening) → **`0005_complete_swarm`** (journal `version: 7`, breakpoints enabled).
- **Migrations do NOT auto-run on dev startup** — `connections.ts` exposes `migrateDatabase()` but doesn't call it at import time. Run `bun run db:migrate` explicitly.

---

## Query patterns

All DB access is server-side (`*.server.ts`). The codebase uses Drizzle's **relational query API** plus **prepared statements** for the hot paths.

- `src/routes/movie/[movieId]/metric/datasource.server.ts` — `db.query.metrics.findMany({ columns: {...} })` for the metric list.
- `src/routes/movie/[movieId]/metric/[metricId]/datastore.server.ts` — **prepared** queries via `.prepare(name)` + `sql.placeholder('metricId')`:
  - `getMetricWithOptions` — `findFirst` with `with: { options }` eager load.
  - `getMetricOptions` — standalone options fetch.
- `db/scripts/seed.ts` — `db.insert().values()`, `db.update().set().where()`, `db.delete().where()` for upsert-style seeding.

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

- `src/routes/movie/[movieId]/datasource.server.ts` — `getMovie(movieId)` fetches `${PUBLIC_TMDB_API_URL}/3/movie/{id}` **unauthenticated** (no Bearer header) and maps the response to a `Movie` interface. (Known gap — works only because the endpoint tolerates it; should adopt the Bearer token like the search route does.)
- `src/routes/api/search/datasource.server.ts` — `searchMovies(query)` calls `${PUBLIC_TMDB_API_URL}/3/search/movie` (`include_adult=false`, `language=en-US`, `page=1`) **with** `Authorization: Bearer ${TMDB_API_TOKEN}` (from `$env/static/private`) — the first authenticated TMDB call in the repo. Returns `{ results: [] }` on a non-ok response. Shares the `SearchResult` type with the client via `$lib/components/search/types`.
- Images: `src/lib/components/movies/image.svelte` builds responsive `srcset` URLs from `PUBLIC_TMDB_IMAGE_URL` (e.g. `.../t/p` + `w200/w300/.../original` + poster path) — used on the movie detail page. **Search result thumbnails do NOT use this component**: `search/resultPoster.svelte` builds a fixed `w92` URL directly, because the shared `Image` defaults its `src` to `original` (with no `sizes` attr) and would pull ~4 MB of full-res posters to render a 20-row, 40×60px result list.

---

## Component library (`src/lib/components/`)

Organized by domain; most have a companion `*.stories.svelte` (Storybook) and some `*.spec.ts`. Components now use **Svelte 5 runes** (`$props`/`$state`/`$derived`, snippets).

| Group | Components | Purpose |
|---|---|---|
| `theme/` | themeToggle | Light/dark switch (see mechanics below) — **new** |
| `landing/` | topBar, heroSearch | Landing-page chrome: top bar (logo + theme toggle + Sign in) and the hero search. `heroSearch` is now a thin wrapper that renders `search/movieSearch` (the old `goto('/search')` behaviour is gone). |
| `auth/` | hankoAuth, hankoProfile, logoutButton | Hanko web-component wrappers |
| `movies/` | tile, description, image | Movie card, metadata block, responsive poster |
| `frames/` | metricsFrame | Shell for metric pages: back nav + "show more/less" toggle (exposes `detailed` via slot prop) |
| `tiles/` | tile, tileGrid, processTileGrid | Generic card; CSS-grid wrappers; **sequential checkbox grid w/ progress bar** |
| `form/` | button, linkButton, checkboxTile, radioTile | Status-variant button, checkbox-as-tile (uses `nanoid` for ids) |
| `search/` | movieSearch, searchInput, searchResults, searchResult, resultPoster (+ `movieSearch.svelte.ts`, `types.ts`); legacy: searchForm | The live inline search, decomposed (see **Live search** below). `movieSearch.svelte` orchestrates a `MovieSearchState` rune class; `searchInput`/`searchResults`/`searchResult`/`resultPoster` are presentational. `searchForm.svelte` is the older standalone form — no longer on the live path. |
| `navigation/` | simple, item | Inline nav bar + items |
| `text/` | block, tooltip | Collapsible HTML block (renders markdown via `{@html}`), tooltip |
| `visualization/` | progressbar | Horizontal/vertical progress bar driven by `current/total` |

Notable mechanics:
- **`themeToggle.svelte`** — runes-based. On mount reads `localStorage.getItem('theme')`, falling back to `window.matchMedia('(prefers-color-scheme: dark)')`. `apply()` sets `document.documentElement.dataset.theme` and persists to localStorage; the button swaps a remixicon sun/moon.
- **`processTileGrid.svelte`** — uses the `setAttributesToChilds` action to number checkboxes, then enforces sequential selection (checking one auto-checks all preceding; unchecking cascades forward). Exposes a `reset()` method consumed via `bind:this` on the metric evaluation page.
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
| `PUBLIC_TMDB_API_URL` | movie datasource | `https://api.themoviedb.org` |
| `PUBLIC_TMDB_IMAGE_URL` | image component | `https://image.tmdb.org/t/p` |
| `TMDB_API_TOKEN` | `/api/search` datasource (server only) | v4 Read Access Token, sent as `Authorization: Bearer`. Not `PUBLIC_`. Used by the search proxy (the movie-detail `getMovie` currently does *not* send it). |

> `EMAIL_*` / `AUTH_SECRET` in `.env` are **unused leftovers** from the dropped Auth.js setup.
> `.npmrc` sets `engine-strict=true`.

### Local run sequence
```bash
docker run --name midb-pg -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=midb -p 5435:5432 -d postgres:16
bun install
bun run db:migrate     # migrations are NOT auto-run
bun run db:seed        # populate metrics (Bechdel)
bun run dev
```

### npm scripts
`dev` / `build` / `preview` (Vite) · `check` (svelte-check) · `test` = `test:integration` (Playwright) + `test:unit` (Vitest) · `lint` / `format` (prettier + eslint) · `storybook` / `build-storybook` · `db:generate` (drizzle-kit) · `db:migrate` · `db:seed`.

---

## Known gaps / TODO (as of this snapshot)

1. **Evaluations not persisted** — the metric form's `finish`/`failed` actions only `console.log`; need inserts into `evaluations` + `evaluation_results`.
2. **Metric list hardcodes "The Matrix"** as the back-link movie.
3. **No auth gate on evaluation pages** — anyone can open metric pages; saving should require login.
4. **Cast nav item** goes nowhere.
5. **Dashboard** is just the Hanko profile — no evaluation history.
6. **`getMovie` calls TMDB unauthenticated** — the movie-detail datasource omits the Bearer token (works for now, but should adopt `TMDB_API_TOKEN` like `/api/search` does).

---

## Related docs
- `.CLAUDE/plans/major-version-upgrade.md` — phased plan that drove the dep upgrades captured above.
- `.CLAUDE/plans/plan-a-landing-page.md`, `.CLAUDE/plans/plan-landing-page-search.md` — landing-page and search design notes.
- `README.md` (repo root) — original setup notes (contains stale Auth.js-era env vars).
