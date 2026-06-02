# MIDB — Architecture Reference

> Snapshot as of the `feature/movie_page` branch revival (mid-2026). Living document — update as the app evolves.

## What it is

**MIDB (Movie Information Database — working title)** is a web platform for rating and displaying movies through a **diversity lens**. Users log in, find a movie, and evaluate it against structured **metrics** — formal tests for representation. The first (and currently only seeded) metric is the **Bechdel Test**. The design generalizes to many metrics over time.

Movie facts (poster, overview, release date) are **not stored** — they're fetched live from **TMDB** on each request. What *is* stored locally is the diversity evaluation data: who rated which movie against which metric, and which option boxes they checked.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 + Svelte 4 (SSR + client hydration) |
| Runtime / package manager | **Bun** (project is "only tested with Bun"; `bun.lockb` committed) |
| Build / dev | Vite 5 |
| Styling | Tailwind CSS 3 (custom theme) + PostCSS, Remixicon for icons |
| Database | PostgreSQL via **Drizzle ORM** (`postgres-js` driver) |
| Auth | **Hanko** (passwordless / passkeys), JWT verified with `jose` |
| External movie data | **TMDB** REST API v3 (Bearer-token auth) |
| Markdown | `marked` (metric descriptions, pre-rendered at seed time) |
| Testing | Vitest (unit), Playwright (integration), Storybook 7 (component dev) |

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
│   │   └── seed.ts             # `bun run db:seed`   → upserts metrics from db/seeds/*.json
│   ├── seeds/                  # JSON seed data (metrics/*.json; prod/ subdir for production)
│   └── migrations/             # drizzle-kit output: NNNN_*.sql + meta/_journal.json + snapshots
│
├── src/
│   ├── hooks.server.ts         # Auth gate: verifies `hanko` JWT cookie, protects /user/*
│   ├── app.css                 # Tailwind entry (@tailwind directives) + @layer components
│   ├── app.html / app.d.ts     # SvelteKit shell + ambient types
│   ├── routes/                 # File-based routing (see below)
│   └── lib/
│       ├── components/         # Reusable UI, grouped by domain
│       ├── actions/            # Svelte `use:` actions (setAttributesToChilds.ts)
│       └── stores/             # (debounced.ts)
│
├── drizzle.config.ts           # drizzle-kit config (out, schema glob, driver/credentials)
├── svelte.config.js            # adapter-auto; alias $db/* → ./db/*
├── vite.config.ts              # SvelteKit plugin + Vitest test block
├── tailwind.config.js          # Custom theme: colors, spacing, breakpoints
├── postcss.config.js           # tailwindcss + autoprefixer
└── .env                        # DB_CONNECTION, PUBLIC_HANKO_API_URL, PUBLIC_TMDB_*, TMDB_API_TOKEN
```

**Key structural choice:** the database layer (`db/`) sits *outside* `src/`, exposed to the app via the `$db/*` alias defined in `svelte.config.js`. Server-only route modules import `db` from `$db/connections`.

---

## Routes

SvelteKit file-based routing under `src/routes/`. Server-only logic lives in `+page.server.ts` / `*.server.ts` (suffix = never shipped to client).

| Route | Files | Status | Notes |
|---|---|---|---|
| `/` | `+page.svelte`, `+page.server.ts` | **Stub** | Still the default "Welcome to SvelteKit" page. `+page.server.ts` returns `{}`. The search components exist but aren't wired here — **no entry point to the app yet**. |
| `/auth` | `+page.svelte`, `+page.ts`, `+layout.svelte` | Working | Renders Hanko `<hanko-auth>`. On success redirects to `/user/dashboard`. `ssr=false`. Layout centers the widget. |
| `/movie/[movieId]` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts` | Working | Fetches movie **live from TMDB** by id (e.g. `/movie/550`). Renders poster, title, date, overview + nav (Metrics works, **Cast goes nowhere**). |
| `/movie/[movieId]/metric` | `+page.svelte`, `+page.server.ts`, `datasource.server.ts` | Working | Lists all metrics from the DB as clickable tiles. **Back-link movie name is hardcoded to "The Matrix"** — known gap. |
| `/movie/[movieId]/metric/[metricId]` | `+page.svelte`, `+page.server.ts`, `datastore.server.ts` | Working | Metric evaluation form. Sequential checkbox UI w/ progress bar (if `hasRelatedOptions`) or plain grid. **Submit actions only `console.log` — not persisted to DB yet.** |
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
- Managed by **drizzle-kit**; SQL + snapshots in `db/migrations/`, tracked in `meta/_journal.json`.
- Current chain: `0000` movies → `0001` (old Auth.js tables) → `0002_wealthy_trauma` (metrics/options/evaluations) → `0003_robust_black_bird` (Bechdel seed data, custom SQL) → `0004_wet_menace` (rename `related_options`→`has_related_options`, NOT NULL tightening).
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

Passwordless auth via **Hanko Cloud** (tenant URL in `PUBLIC_HANKO_API_URL`). Hanko ships **web components**, registered client-side.

1. **Login** — `/auth` renders `<hanko-auth>` (via `hankoAuth.svelte`, which calls `register(PUBLIC_HANKO_API_URL)` in `onMount`). On the success event the page `goto("/user/dashboard")`.
2. **Session** — Hanko sets a `hanko` JWT cookie.
3. **Gate** — `src/hooks.server.ts` runs on every request: reads the `hanko` cookie, builds a remote JWKS from `${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`, and `jwtVerify()`s it with `jose`. Any `/user/*` path with an invalid/absent token → `redirect(303, "/auth")`.
4. **Profile** — `/user/dashboard` renders `<hanko-profile>` (manage passkeys/email).
5. **Logout** — `logoutButton.svelte` constructs `new Hanko(url)` and calls logout, then redirects.

Components: `src/lib/components/auth/{hankoAuth,hankoProfile,logoutButton}.svelte`.

> Auth history: the repo migrated **from Auth.js (NextAuth) to Hanko**. Migration `0001` created Auth.js tables; a later migration on this branch keeps only `user`. Leftover `@auth/*` deps and SMTP/`AUTH_SECRET` env vars were dropped/are unused.

---

## TMDB integration

- `src/routes/movie/[movieId]/datasource.server.ts` — `getMovie(movieId)` fetches `${PUBLIC_TMDB_API_URL}/3/movie/{id}` with an `Authorization: Bearer ${TMDB_API_TOKEN}` header (the v4 Read Access Token, server-side only) and maps the response to a `Movie` interface.
- Images: `src/lib/components/movies/image.svelte` builds responsive `srcset` URLs from `PUBLIC_TMDB_IMAGE_URL` (e.g. `.../t/p` + `w200/w300/.../original` + poster path).

---

## Component library (`src/lib/components/`)

Organized by domain; most have a companion `*.stories.svelte` (Storybook) and some `*.spec.ts`.

| Group | Components | Purpose |
|---|---|---|
| `auth/` | hankoAuth, hankoProfile, logoutButton | Hanko web-component wrappers |
| `movies/` | tile, description, image | Movie card, metadata block, responsive poster |
| `metric` UI | (in `frames/`) metricsFrame | Shell for metric pages: back nav + "show more/less" toggle (exposes `detailed` via slot prop) |
| `tiles/` | tile, tileGrid, processTileGrid | Generic card; CSS-grid wrappers; **sequential checkbox grid w/ progress bar** |
| `form/` | button, linkButton, checkboxTile, radioTile | Status-variant button (6 variants), checkbox-as-tile (uses `nanoid` for ids) |
| `search/` | searchForm, movieSearch | Search input emitting events — **`movieSearch.svelte` is empty**, not wired up |
| `navigation/` | simple, item | Inline nav bar + items |
| `text/` | block, tooltip | Collapsible HTML block (renders markdown via `{@html}`), tooltip |
| `visualization/` | progressbar | Horizontal/vertical progress bar driven by `current/total` |

Notable mechanics:
- **`processTileGrid.svelte`** — uses the `setAttributesToChilds` action to number checkboxes, then enforces sequential selection (checking one auto-checks all preceding; unchecking cascades forward). Exposes a `reset()` method consumed via `bind:this` on the metric evaluation page.
- **`tile.svelte`** — polymorphic via `<svelte:element this={el}>` (renders as `div`, `a`, or `label`).

---

## Configuration & environment

`.env` (gitignored) — required vars:

| Var | Used by | Notes |
|---|---|---|
| `DB_CONNECTION` | `connections.ts` (read via `process.env`) | Postgres URL. Local dev: container on **port 5435** (`postgres://postgres:mysecretpassword@0.0.0.0:5435/midb`). |
| `PUBLIC_HANKO_API_URL` | hooks + auth components | Hanko Cloud tenant URL. |
| `PUBLIC_TMDB_API_URL` | movie datasource | `https://api.themoviedb.org` |
| `PUBLIC_TMDB_IMAGE_URL` | image component | `https://image.tmdb.org/t/p` |
| `TMDB_API_TOKEN` | movie datasource (server only) | v4 Read Access Token, sent as Bearer. Not `PUBLIC_`. |

> `EMAIL_*` / `AUTH_SECRET` in `.env` are **unused leftovers** from the dropped Auth.js setup.

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
`dev` / `build` / `preview` (Vite) · `check` (svelte-check) · `test` (Playwright + Vitest) · `lint` / `format` (prettier + eslint) · `storybook` / `build-storybook` · `db:generate` (drizzle-kit) · `db:migrate` · `db:seed`.

---

## Known gaps / TODO (as of this snapshot)

1. **Home page** — placeholder; `movieSearch.svelte` empty. No way to discover movies from the UI (must hit `/movie/<tmdb-id>` directly).
2. **Evaluations not persisted** — the metric form's `finish`/`failed` actions only `console.log`; need inserts into `evaluations` + `evaluation_results`.
3. **Metric list hardcodes "The Matrix"** as the back-link movie.
4. **No auth gate on evaluation pages** — anyone can open metric pages; saving should require login.
5. **Cast nav item** goes nowhere.
6. **Dashboard** is just the Hanko profile — no evaluation history.

---

## Related docs
- `major-version-upgrade.md` (same folder) — phased plan to bring all deps to latest major (except Storybook 7.x / TypeScript 5.x).
- `README.md` (repo root) — original setup notes (contains stale Auth.js-era env vars).
