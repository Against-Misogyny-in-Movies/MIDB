# Architecture review (2026-10-24)

> **Implemented 2026-10-25** by `plan-architecture-remediation.md` (7 PRs, #11–#16 plus the PR 7 docs sweep). Kept as the record of the findings; the current state is in `.CLAUDE/architecture.md`.

Review of `main` at `cc36c50` ("implement user authentication and community features"). Scope: everything under `src/`, `db/`, the config files, and the agent docs. The project is a WIP, so the question is which decisions will hold up once community writes, comments and real traffic arrive, and which ones need correcting now while they are still cheap to change.

Baseline measured during the review: `bun run test:unit` → 116/116 pass (8 files). `bun run check` → 9 errors, all from missing `$env/static/*` vars (the container has no `.env`, and the repo has no `.env.example`).

---

## 1. Verdict in one paragraph

The **front-end and server-module architecture is good** and better than most projects at this stage: a clear `$lib/server` boundary, thin routes, type-only re-exports to the client, a swappable cache, read-only GET resolvers, streamed DDD with zero-layout-shift placeholders, pure verdict logic with real tests, and a living architecture doc. The weak points are all at the **data and deployment edges**: the DB schema is still shaped around "a movie seeded from a Bechdel CSV" rather than "a title with sources and community input". Committed migrations have drifted from the schema. Auth runs a write on every request. One CDN caching header can leak personalised HTML. Those should be fixed before the community write path is built on top of them.

---

## 2. Things to fix now (correctness / security)

### 2.1 Committed SendGrid credential in `README.md` (security, P0)

`README.md` contains what looks like a live SendGrid API key (`SG.pk0Enm…`), committed in `5caff29 add readme` and still on `main`. **Rotate/revoke it in SendGrid first**, then remove it from the README. Removing it from the file does not remove it from git history. The rest of that README is also stale (Auth.js-era `EMAIL_*`/`AUTH_SECRET`, "migrations run at startup"). Replace it with a short setup section and an `.env.example` (see 4.6).

### 2.2 CDN may cache personalised pages (security / privacy, P0)

`movie/[movieId]/+page.server.ts` and `tv/[seriesId]/+page.server.ts` set `cache-control: public, s-maxage=3600`. That header applies to the **whole response**, including the root `+layout.server.ts` data, which serialises `locals.user` (the full `UserRow`: id, **email**, role, username) into the HTML and `__data.json`. On Vercel, the edge cache does not vary on the `hanko` cookie. So the first signed-in visitor's navbar and email can be served to everyone for an hour, and a signed-out render can be served to signed-in users.

Fix options, in order of preference:

1. Keep detail pages CDN-cacheable and make the shell **user-agnostic on the server**: remove `user` from the root layout load and fetch the session client-side from a tiny uncached endpoint (`/api/me`), or render the navbar's auth slot client-side. This preserves the performance goal.
2. Or set `public` only when `!locals.user`, and `private, no-store` otherwise. This is simpler, but logged-in users lose the CDN.

Either way, **stop shipping the whole `UserRow` to the client**. Define a `PublicUser = { username, avatarKey, role }` DTO in `$lib/media/types/user.ts` and map to it in the layout load. Email belongs only on `/user/profile`.

### 2.3 Migrations have drifted from the schema (P0 for anyone setting up)

`db/migrations/0000_jazzy_tag.sql` creates `user` (old shape), `movies`, `movie_bechdel`, `movie_unconsenting`, `movie_trigger_tags` and `um_source`. It does **not** contain `user_role`, `username`, `avatar_key`, `metric_kind`, `community_metric_submissions` or `comments`. On a fresh DB, `bun run db:migrate` produces a schema where `getOrCreateUser` fails (no `role` column), so **every authenticated request returns 500** from `hooks.server.ts`. `architecture.md` Known gaps §1 acknowledges this as "pending", but the commit message says the feature is implemented.

Fix: generate `0001_*` now (TTY) and commit it in the same PR as schema changes from now on. Add a CI step that runs `drizzle-kit check` (or `generate --dry-run`, failing on a non-empty diff) so drift can't land again.

### 2.4 TV write path would insert `tmdb_id = 0` (latent bug)

`getOrCreateDbMedia(…, 'tv')` passes `tmdbId: '0'` with the comment "forces NaN parse → null". But `parseInt('0', 10)` is `0`, not `NaN`. The first TV insert writes `tmdb_id = 0`, and the second hits the `UNIQUE(tmdb_id)` constraint. The read path also runs a useless `WHERE tmdb_id = 0` lookup. Nothing calls the write path yet, which is why it hasn't surfaced. It will be the first bug of the community milestone. The root cause is the schema design in 3.1. Fix that, and this hack disappears.

### 2.5 Auth hook writes to the DB on every request

`handle` runs `INSERT … ON CONFLICT DO UPDATE … RETURNING` for every signed-in request: every page, every `__data.json`, every `/api/search` keystroke, every `availability` check. Even when it's a no-op, the upsert takes a row lock and generates WAL. Proposed changes:

- `SELECT` first and only `INSERT` on miss (JIT provisioning happens once per user, ever).
- Skip the DB entirely for routes that don't need the user (`/api/search`). A cheap way to do that is to resolve `locals.user` lazily (`locals.getUser()` memoised per request) instead of eagerly in `handle`.
- Optionally cache `sub → PublicUser` in `getCached` for ~60 s.

---

## 3. Data model: the decision that most needs rethinking

### 3.1 `movies` is overloaded as the spine for everything

Current state:

- TV series live in `movies` with a synthetic `imdb_id = 'tmdb-tv:<id>'` and a null `tmdb_id`, because TMDB movie and TV ids share a numeric space.
- `imdb_id` is `NOT NULL UNIQUE`, so titles without an IMDb id get a fake one (`tmdb:<id>`).
- `year NOT NULL` with `0` as a sentinel.
- The read path decides "movie vs tv" with a `kind` argument threaded through wrappers.

This was a reasonable seed-first shortcut (the Bechdel CSV is IMDb-keyed). But community ratings and comments now hang off `movies.id` via FK, which makes the shortcut permanent unless it is fixed before the first user writes land.

**Proposal — a proper `titles` spine:**

```text
titles
  id            uuid pk
  kind          title_kind enum ('movie','tv')   NOT NULL
  tmdb_id       integer                           NULL
  imdb_id       varchar                           NULL
  title, clean_title, year (NULL = unknown), timestamps (timestamptz)
  UNIQUE (kind, tmdb_id)
  UNIQUE (imdb_id) WHERE imdb_id IS NOT NULL
```

- Natural key is `(kind, tmdb_id)` because TMDB is where every request starts (search → `/movie/:tmdbId`). `imdb_id` is a secondary key used only to join seeded sources.
- Kills the `tmdb-tv:`/`tmdb:` synthetic ids, the `'0'` hack, `getDbMedia`'s wrapper, and the `year = 0` sentinel.
- Do it **now**: the community tables are empty, so the rename and backfill are a single migration. After the first real rating, it is a data migration.

### 3.2 Source data: reference, don't copy

`movie_unconsenting` duplicates every column of `um_source` (9 booleans + comment + clean name). The seeder snapshots them, so a UM reseed updates `um_source` but leaves stale copies in the bindings. Proposal: make the binding a join table, `title_um (title_id pk → titles, um_id → um_source)`, and read flags through the FK. The runtime candidate picker already reads from `um_source`, so both paths would use one row shape (`UmCandidate` and `UnconsentingData` collapse into one type).

### 3.3 `community_metric_submissions.value smallint` can't hold the metrics it names

`metric_kind` is `bechdel | unconsenting | ddd`, but:

- Bechdel fits in a smallint (0–3).
- UM is **nine independent booleans**. One smallint can't represent it without bit-packing.
- DDD is **per-topic** (hundreds of topics per title, each yes/no), so "one row per (user, title, metric)" is the wrong cardinality entirely.

Proposal: one table per metric shape, which keeps the constraints honest:

- `community_bechdel (user_id, title_id, rating smallint CHECK 0..3, PK(user_id,title_id))`
- `community_um (user_id, title_id, <9 boolean cols> | flags jsonb validated by zod, PK(user_id,title_id))`
- `community_ddd_vote (user_id, title_id, topic_id, vote boolean, PK(user_id,title_id,topic_id))`, plus season/episode columns for TV.

Aggregates (the "MIDB community score" shown beside the source score) can come from a query at first, and later from a materialised view refreshed on write.

### 3.4 Smaller schema notes

- `timestamp` → `timestamp with time zone` everywhere. Drizzle `timestamp()` without `withTimezone` stores local wall-clock time.
- `updatedAt` is never maintained automatically. Use `.$onUpdate(() => new Date())` so every write path doesn't have to remember it.
- `movie_trigger_tags` is defined but never written, and its row-per-topic copy of DDD would go stale. If DDD persistence ever ships, cache it as a JSON snapshot with `fetched_at` instead of normalising third-party data into tables.
- `comments` needs `deleted_at`/`status` (moderation exists as a role but has no data to act on), and probably `parent_id` if threads are planned.

---

## 4. Module structure

### 4.1 What works and should be kept

- `$lib/server/{data,integrations,cache}` split, with the hard boundary documented and enforced by SvelteKit.
- Type-only re-exports through `$lib/media/types/*`.
- `verdict.ts` as pure functions with a 554-line spec: the most important business logic is the best-tested code in the repo.
- `getCached(key, ttl, fetcher)` with an env-switchable Redis backend that fails open.
- Streaming DDD as an un-awaited promise, with `createDddState` providing a `pending` state.
- Plans saved in `.CLAUDE/plans/`, and the architecture doc.

### 4.2 Dependency direction violations

- `$lib/server/data/user-queries.ts` imports `AVATAR_KEYS` from `$lib/components/user/avatars/avatars.ts`, which imports six `.svelte` components. The server data layer now pulls UI components into the server bundle. Move the **keys/names** into `$lib/media/utils/avatars.ts` (plain data) and keep the `key → component` map in the component folder.
- `src/lib/server/data/*` imports `normalizeTitle` from `$db/scripts/lib/`. Runtime code shouldn't depend on a scripts folder. Move it to `db/lib/normalizeTitle.ts` (or `$lib/media/utils/`), and have the seeders import it from there too. Matching keys must stay identical between seeding and runtime, so one shared module is correct; its location is the only problem.
- `CREW_SCORED_DEPARTMENTS` in `verdict.ts` is a hand copy of `PRIORITY_DEPARTMENTS` in `tmdb.ts`, with a "must stay in sync" comment. Define it once in `$lib/media/utils/` and import it in both places.

### 4.3 Movie / TV duplication

`movie/datasource.server.ts` and `tv/datasource.server.ts` repeat the same TMDB mapping (genres, languages, credits, gender aggregation, cache wrapper); only the fields that differ actually differ. The two `+page.svelte` scripts are also ~80% identical (UM candidate selection, DDD state, verdict derivation). Proposal:

- `$lib/server/integrations/tmdb.ts` → `fetchTitle(kind, id)` returning a shared `MediaDetail` plus a kind-specific tail. The route `datasource.server.ts` files become a single call, or go away.
- A `$lib/media/utils/titleState.svelte.ts` rune class that owns `selectedUm`, `umData`, `ddd`, `safety` and `representation`, so each page only lays out components.
- A shared `loadTitle(kind, id)` in `$lib/server/` that does TMDB → `titles` row → sources → streamed DDD. The movie and TV `+page.server.ts` files become three lines each.

### 4.4 Env and config

- `vite.config.ts` uses `define` to inline `process.env.DB_CONNECTION` **at build time**. This bakes the connection string into the server bundle and ignores runtime env changes (e.g. rotating the DB password on Vercel needs a rebuild). It also means `db/connections.ts` silently falls back to `postgres:postgres@localhost`. Read `$env/dynamic/private` at runtime instead, and throw if the variable is missing in production. Scripts run under Bun, where `process.env` already works.
- `$env/static/*` for `PUBLIC_*_URL` and API tokens is fine, but `check` fails without a `.env`. Add `.env.example` (already whitelisted in `.gitignore`), so `check` works in CI and fresh clones.
- `vercel.json` installs with `npm install --legacy-peer-deps`, while local dev uses Bun with `bun.lock`. Two package managers with different lockfiles means production resolves different versions than the ones tested. Pick one (Vercel supports Bun installs) and remove `--legacy-peer-deps` by fixing the peer conflicts.
- `@playwright/test`, `jsdom` and `@types/jsdom` are pinned to `latest`. Pin real ranges.

### 4.5 Dependencies that don't pull their weight

- `rxjs` is used only for a 500 ms debounce with `switchMap` (`stores/debounced.ts`). An ~15-line rune helper (timeout + `AbortController`) does the same job and also cancels the in-flight `fetch`, which `switchMap` over a Promise does not.
- `nodemailer` and `adapter-auto` are unused (Hanko handles mail, and the adapter is Vercel). Remove both.
- `nanoid` is used for form ids. Svelte 5.20+ has `$props.id()` for SSR-stable ids, so nanoid ids also cause hydration mismatches.

### 4.6 Repo hygiene

- Delete the orphans listed in AGENTS.md (`processTileGrid`, `metricsFrame`, `sectionSkeleton`, `landing/topBar`) and the unused `navigation/*` components, instead of keeping a "do not revive" list. Version control is the archive.
- `ddd_check.mjs` at the repo root is a one-off debug script. Turn it into a Playwright spec or delete it.
- `src/__tests__/index.test.ts` (`1 + 2 = 3`) and `e2e-tests/test.ts` add noise. Remove them.
- `user/dashboard/+page.ts` is an empty file.
- `architecture.md` has drifted in places, e.g. "dev/boot also runs migrations via hooks.server.ts" (removed in `742c612`) and "50/50 tests" (now 116). Consider moving the long "verification baseline after X" log out of the doc, since git history already records it.

---

## 5. Product-level architecture for the next milestone

Community ratings and comments are next. Suggested shape, consistent with the existing conventions:

1. **Writes through form actions**, not ad-hoc `+server.ts` endpoints, on the title page (`?/rate`, `?/comment`). This gives progressive enhancement and SvelteKit's built-in CSRF origin check for free.
2. **Validation at the boundary** with a schema library (valibot or zod, ~1 dep), shared between the action and the client form. `updateProfile`'s hand-rolled checks are fine for two fields but won't scale to UM's nine flags.
3. **Authorization in one place.** Keep the hook gate for `/user/*`, but add `requireUser(locals)` / `requireRole(locals, 'moderator')` helpers, called inside every action. Form actions on public pages (`/movie/:id?/rate`) are not covered by the `/user` prefix check. Also tighten the prefix check from `startsWith('/user')` to `startsWith('/user/') || === '/user'`; today `/users…` or `/username` would also redirect.
4. **Keep detail pages cacheable** after adding personalised bits (the user's own rating): load the public part in `+page.server.ts` (CDN-cacheable once 2.2 is fixed), and the user-specific part in a separate uncached `fetch`/streamed promise, using the same pattern DDD already uses.
5. **Rate limiting** on `/api/search` and on write actions (search proxies TMDB with a server token on every debounced keystroke and is not cached). Add `getCached('tmdb:search:'+q, 10 min)` and a per-IP token bucket in the same cache backend.
6. **Integration tests against a real Postgres.** The DB layer has no tests today (all 116 tests are pure functions or components). Add a Vitest project that runs `db:migrate` against a throwaway Postgres (Docker or `pglite`) and covers `getOrCreateUser`, title resolution and the new community writes. This would have caught 2.3 and 2.4.
7. **CI** (none exists): `check`, `lint`, `test:unit`, `build`, plus the migration-drift check from 2.3, on every PR.

---

## 6. Suggested order

| #   | Change                                                                     | Size | Why now                            |
| --- | -------------------------------------------------------------------------- | ---- | ---------------------------------- |
| 1   | Rotate the SendGrid key, rewrite README, add `.env.example`                | S    | Live secret                        |
| 2   | Fix CDN caching / `PublicUser` DTO (2.2)                                   | S    | Data leak once deployed            |
| 3   | Generate + commit `0001` migration, add drift check (2.3)                  | S    | Fresh setups are broken            |
| 4   | Lazy, read-first user resolution in hook (2.5)                             | S    | Write per request                  |
| 5   | `titles` spine with `(kind, tmdb_id)` + UM binding by reference (3.1, 3.2) | M    | Must precede first community write |
| 6   | Per-metric community tables (3.3)                                          | M    | Same                               |
| 7   | Dependency direction fixes, shared constants (4.2)                         | S    | Cheap                              |
| 8   | Movie/TV loader + page-state unification (4.3)                             | M    | Halves the code touched by step 9  |
| 9   | Community write path per §5                                                | L    | The milestone                      |
| 10  | CI + DB integration tests, dep cleanup (4.4–4.6, 5.6–5.7)                  | M    | Ongoing                            |
