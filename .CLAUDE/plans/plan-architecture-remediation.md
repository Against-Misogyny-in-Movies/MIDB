# Plan: Architecture remediation

Implements every finding in `plan-architecture-review.md`. All the choices are already made. Where the review offered options, this plan picks one and gives the reason. The work ships as **7 PRs in order**, each independently green (`check` 0 errors, `test:unit` pass, `build` clean, plus CI from PR 1 on). Each PR updates `.CLAUDE/architecture.md` for the files it touches, as AGENTS.md requires.

| PR  | Theme                                                                                   | Fixes (review §)                           | Risk                                   |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| 1   | Secrets, env template, formatting, CI (**done 2026-10-24**)                             | 2.1, 4.4 (`.env.example`), 4.6 partly, 5.7 | Low                                    |
| 2   | Session out of SSR, lazy auth, guards (**done 2026-10-24**)                             | 2.2, 2.5, 5.3                              | Medium (navbar UX)                     |
| 3   | DB client from runtime env, migration drift, DB test harness (**done 2026-10-24**)      | 2.3, 4.4 (`define`), 5.6                   | Low                                    |
| 4   | `titles` spine, sources by reference, community tables (**done 2026-10-24**)            | 2.4, 3.1–3.4                               | **High** (data migration)              |
| 5   | Module consolidation (TMDB, loader, page state, shared constants) (**done 2026-10-24**) | 4.2, 4.3                                   | Medium (refactor, no behaviour change) |
| 6   | Dependencies, search caching, rate limit, dead code (**done 2026-10-25**)               | 4.4 (deps), 4.5, 4.6, 5.5                  | Low                                    |
| 7   | Docs sweep (AGENTS.md, architecture.md)                                                 | 4.6 (doc drift)                            | None                                   |

Out of scope: the community **feature** itself (rating and comment UI and actions). This plan builds the schema, guards, validation choice and test harness it needs. The feature gets its own plan afterwards (step 9 of the review's ordering).

---

## Pre-flight (owner actions, not code)

1. **Revoke the SendGrid key** `SG.pk0Enm…` in the SendGrid dashboard now. This is the actual fix. Removing it from the README only stops new copies.
   - **Decision: no git-history rewrite.** Once the key is revoked it is worthless, and a force-push rewriting `main` would break the existing collaborator's (Wolfgang Rathgeb) clones for no security gain.
2. Before PR 4 is applied anywhere, confirm whether a deployed database exists. If one does:
   - run `SELECT count(*) FROM comments; SELECT count(*) FROM community_metric_submissions;` (both must be 0; they are dropped);
   - take a `pg_dump`.

---

## PR 1: Secrets, env template, formatting, CI

**Status: done 2026-10-24.** `src/routes/user/dashboard/+page.ts` was kept: it is not empty but holds `export const ssr = false`, which the dashboard relies on (see architecture.md _Routes_). Also added: `db/migrations` to `.prettierignore`, so drizzle-kit output is not reformatted and new migrations do not fail `lint`.

**Goal:** the repo is safe to read and every later PR is gated by CI.

1. `README.md`: rewrite. Remove all Auth.js-era vars and the key. Contents:
   - what MIDB is;
   - prerequisites (Bun, Docker);
   - `cp .env.example .env`;
   - `docker compose up -d db`;
   - `bun run db:migrate && bun run db:seed:movies && bun run db:seed:um`;
   - `bun run dev`;
   - pointers to `AGENTS.md` and `.CLAUDE/architecture.md`.
2. `.env.example` (already allow-listed in `.gitignore`), with placeholder values that are valid enough for `check` and `build`:
   ```env
   DB_CONNECTION=postgres://postgres:postgres@localhost:5432/midb
   PUBLIC_HANKO_API_URL=https://example.hanko.io
   PUBLIC_TMDB_API_URL=https://api.themoviedb.org
   PUBLIC_TMDB_IMAGE_URL=https://image.tmdb.org/t/p
   TMDB_API_TOKEN=
   DDD_API_KEY=
   # REDIS_URL=redis://localhost:6379
   ```
3. `docker-compose.yml`:
   - `postgres:16` (matches the architecture doc);
   - drop the obsolete `version:` key;
   - DB `midb` on 5432.

   Then make `architecture.md`'s "Local run sequence" use compose instead of the ad-hoc `docker run` on port 5435, so the README, the doc and `.env.example` share one URL.

4. **Formatting baseline.** One commit, `chore: format`, containing only `bun run format`, so the diff is reviewable as "whitespace only". Then fix the 9 eslint errors in a separate commit.
5. Delete pure noise:
   - `src/__tests__/index.test.ts` (`1 + 2`);
   - `e2e-tests/test.ts` (duplicates `landing.spec.ts`);
   - `ddd_check.mjs`;
   - empty `src/routes/user/dashboard/+page.ts`.
6. Extend the existing `.github/workflows/tests.yml` (it already has a `unit` job and a gated `e2e` job) with a `static` job:
   - `oven-sh/setup-bun` → `bun install --frozen-lockfile` → `cp .env.example .env`
   - `bun run check`, `bun run lint`, `bun run build` (unit tests already run in the `unit` job)
   - The migration drift job and the DB test job are added in PR 3.
   - The `e2e` job turns on when the `E2E_ENABLED` repo variable and the TMDB/DDD secrets are set. `playwright.config.ts` should switch its `webServer.command` from `npm` to `bun run build && bun run preview` in this PR.

**Done when:** CI is green on the PR, and `bun run check` passes on a fresh clone with only `.env.example` copied.

---

## PR 2: Session out of SSR, lazy auth, guards

**Status: done 2026-10-24.** Implemented as specified. Deviations and additions:

- **Guard signature:** `requireUser(locals, { page })` / `requireRole(locals, roles, { page })` (an options object and a roles array instead of `...roles`), so page loads can opt into the redirect explicitly. The default is 401.
- **Moderation link** moved from a text link in the desktop nav row into the navbar's fixed-size auth slot, as a shield icon (md+; the mobile menu keeps its text item). A text link that appears after `/api/me` resolves would shift its siblings.
- **"Sign in"** moved from the desktop link row into the auth slot, and so it now also shows in the bar below md. The slot is a fixed `10.5rem` (5.5rem below 480px), and the username truncates to fit.
- **`PRIVATE_NO_STORE`** constant added next to `PUBLIC_PAGE` in `cache.ts`.
- **`/resources/+page.server.ts`** added only to set `PUBLIC_PAGE` (the page had no server load, so it sent no `cache-control`).
- **Profile action** returns `me: PublicUser` instead of the `UserRow`; the profile load returns only `email` (the rest comes from the layout's `me`).
- **`UserRow` is no longer re-exported** from `$lib/media/types/user.ts`, so client code cannot type a prop as a full row.
- **`.vercel/**`added to the eslint ignores**, so`bun run lint`passes after a local`bun run build` (adapter-vercel writes there).
- **DB-level "no write on repeat" test** for `getOrCreateUser` (`xmin` unchanged) is deferred to PR 3's harness, as planned.
- **Not verified on a real detail page:** no TMDB token was available, so `/movie/603` rendered its 401 error page. The header and payload checks ran on it and on `/` and `/resources`. Observed, not changed: the detail loads set `PUBLIC_PAGE` before fetching, so TMDB error pages are CDN-cacheable for an hour too.

### Decision: user-agnostic HTML plus a client-side session

Options considered:

- **(a) Conditional `cache-control`** (public when signed out, private when signed in): rejected. The Vercel edge cache key ignores cookies, so a signed-in visitor would be served the cached signed-out page.
- **(b) `private` everywhere:** rejected. It loses the CDN, which conflicts with AGENTS.md's performance priority.
- **(c) Chosen: server-rendered HTML never contains user data.** Detail and landing pages stay CDN-cacheable, and the navbar's auth slot hydrates from a tiny uncached endpoint. AGENTS.md's zero-layout-shift rule is met by giving the slot a reserved fixed size.

### Steps

1. **`$lib/server/auth/hanko.ts`**: move the JWKS, `emailFromClaims` and `verifyClaims` code out of `hooks.server.ts` unchanged.
2. **`$lib/server/data/user-queries.ts`**: change `getOrCreateUser` to read first:
   - `SELECT` by id; on a hit, return it. If `email` is null and the claim has one, `UPDATE` once.
   - On a miss: `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *`. If that returns nothing (a concurrent first request won), `SELECT` again.
   - Steady state: one primary-key read, zero writes.
3. **Lazy user resolution** in `hooks.server.ts`:
   ```ts
   event.locals.claims = await verifyClaims(event); // local crypto; JWKS cached
   let userP: Promise<UserRow | null> | undefined;
   event.locals.getUser = () =>
   	(userP ??= event.locals.claims?.sub
   		? getOrCreateUser({
   				sub: event.locals.claims.sub,
   				email: emailFromClaims(event.locals.claims)
   			})
   		: Promise.resolve(null));
   ```
   - The hook only gates. `/user` and `/user/*` (tightened from `startsWith('/user')`, which also caught `/users…`) redirect on missing claims, with no DB access.
   - `/user/moderation*` awaits `getUser()` for the role.
   - `app.d.ts`: `Locals = { claims: JWTPayload | null; getUser(): Promise<UserRow | null> }`. Remove `PageData.user`.
4. **`$lib/server/auth/guards.ts`**:
   - `requireUser(locals)` throws `error(401)`, or `redirect(303,'/auth')` for page loads.
   - `requireRole(locals, ...roles)` throws `error(403)`.
   - Every `/user/*` load, action and endpoint calls one of these instead of `locals.user!`. This also covers form actions on public pages later.
5. **`PublicUser` DTO** in `$lib/media/types/user.ts` (client-safe, no runtime from server):
   ```ts
   export type PublicUser = {
   	username: string | null;
   	avatarKey: string | null;
   	role: UserRole;
   	displayName: string;
   };
   ```
   - `toPublicUser(row)` in `$lib/server/data/user-queries.ts`.
   - The `displayName` fallback (username → email local-part → "Account") moves server-side, so the email never leaves the server except on `/user/profile`.
   - The duplicate `displayName()` helpers in `navbar.svelte` and `profile/+page.svelte` are deleted.
6. **Remove `user` from `src/routes/+layout.server.ts`.** Delete the file if nothing else remains.
7. **`src/routes/api/me/+server.ts`**: `GET` returns `PublicUser | null` with `cache-control: private, no-store`.
8. **`src/routes/user/+layout.server.ts`**: `requireUser`, then returns `{ me: toPublicUser(user) }`. These pages are personalised and send `private, no-store`. `/user/profile/+page.server.ts` additionally returns `email` for its own display.
9. **Client session rune** `$lib/media/utils/session.svelte.ts`:
   - `session.status: 'pending' | 'anon' | 'user'` and `session.user`.
   - `session.load()` fetches `/api/me` once per page load (not per navigation).
   - `session.set(u)` is used when `/user/*` layout data already has the user.
   - `session.clear()` is used on logout.
   - **First-paint hint:** Hanko's `hanko` cookie is set from JS (not httpOnly), so `document.cookie.includes('hanko=')` picks the placeholder shape (avatar circle or "Sign in") before the fetch resolves. SSR renders the slot empty, at a fixed `min-width`/height, with `aria-busy="true"`.
10. **`navbar.svelte` / `navbarMenu.svelte`**: read from `session` instead of the `user` prop. The moderation link stays a client-side convenience; authorization stays server-side (step 3).
11. **`logoutButton.svelte`** (bug): `await hanko.logout()`, then `session.clear()`, then `goto('/auth', { invalidateAll: true })`. Today `goto` runs before logout completes.
12. **Cache headers helper** `$lib/server/http/cache.ts` exports `PUBLIC_PAGE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'`. Movie, TV, `/` and `/resources` loads use it. Keeping it in one constant makes the policy greppable.

### Tests

- Unit:
  - `toPublicUser` (the email is never present, plus the fallback order);
  - the guards (redirect, 401, 403);
  - the hook (no `getUser` call on `/movie/1`; redirect on `/user/x` without claims; `/users` not gated);
  - `session` rune state transitions.
- DB (in PR 3's harness, added there): `getOrCreateUser` does no write on the second call (`xmin` unchanged).
- Manual: two browsers (signed in and signed out) hitting the same movie URL through `vercel --prod` preview. View the source: no username or email in the HTML or in `__data.json`.

---

## PR 3: Runtime DB config, migration drift, DB test harness

1. **`db/client.ts`** (replaces `db/connections.ts`):
   ```ts
   export function createDb(url: string, opts?: { max?: number }) {
   	const sql = postgres(url, { connect_timeout: 10, max: opts?.max ?? 10 });
   	return { db: drizzle(sql, { schema }), sql };
   }
   export type Db = ReturnType<typeof createDb>['db'];
   ```
   - `schema` is `db/schema/index.ts`, a single barrel re-exporting every schema file. `drizzle.config.ts` points at the barrel's folder as before.
2. **App access** `$lib/server/db.ts`:
   - Lazily `createDb(env.DB_CONNECTION)` from `$env/dynamic/private` on first use.
   - Throws a clear error if the variable is unset. There is **no localhost fallback** any more, so a misconfigured deploy fails loudly instead of trying to reach localhost.
   - Lazy creation also means `build` and `check` never need a DB.
   - All `$lib/server/data/*` modules import `db` from here.
3. **Scripts**: `db/scripts/lib/db.ts` builds `createDb(process.env.DB_CONNECTION!)`, using `max: 1` for migrate. `migrateDatabase` moves into `db/scripts/migrate.ts`. Seeders import from `./lib/db`.
4. **Remove `define: { 'process.env.DB_CONNECTION' … }`** and the `loadEnv` call from `vite.config.ts`.
5. **Migration `0001`**: run `bun run db:generate` against the current schema. It will prompt for the `user` table changes:
   - answer **create/drop** (the Auth.js-era `user` rows are useless: their ids are not Hanko subs);
   - review the SQL;
   - commit SQL and snapshot.

   Agents without a TTY run it through `script -qec "bunx drizzle-kit generate" /dev/null` and answer the prompts. If that isn't possible, hand the step to the owner. **Never hand-write a snapshot JSON.**

6. **Drift check** (CI job `migrations`):
   ```sh
   bunx drizzle-kit generate --name drift_check
   test -z "$(git status --porcelain db/migrations)" || { echo "Schema changed without a committed migration"; git status --porcelain db/migrations; exit 1; }
   ```
   `drizzle-kit generate` needs no DB connection. If it prompts, the job fails because there is no TTY, which is also the correct outcome.
7. **DB test harness**:
   - `vitest.config` gets a second project via `test.projects`:
     - `unit`: today's config;
     - `db`: `include: ['src/**/*.db.spec.ts', 'db/**/*.db.spec.ts']`, `environment: 'node'`, `fileParallelism: false`, and `globalSetup: 'db/test/global-setup.ts'`, which runs migrations against `TEST_DB_CONNECTION` from zero.
   - `db/test/reset.ts` runs `TRUNCATE … RESTART IDENTITY CASCADE` on all app tables in `beforeEach`.
   - `$lib/server/db.ts` honours `TEST_DB_CONNECTION` when `process.env.VITEST` is set.
   - Scripts: `test:unit` → `vitest --project unit`; new `test:db` → `vitest run --project db`.
   - CI job `db`: `services: postgres:16`, then `bun run test:db`. This job also proves that migrations apply cleanly from an empty DB.
8. Initial DB tests:
   - `getOrCreateUser` (insert once, no write on repeat, email backfill);
   - `updateProfile` (unique `lower(username)` maps to `username-taken`);
   - `isUsernameAvailable`.

**Done when:** a fresh `docker compose up` + `db:migrate` gives a DB the app runs against, and CI's `migrations` and `db` jobs are green.

**Status: done 2026-10-24.** Deviations and findings:

- `0001_swift_wolverine`: drizzle-kit asks _create vs rename_ per `user` column, not _create/drop_ per table (the table name is unchanged). Every column was answered _create_, so the Auth.js columns are dropped and the new ones added. Existing Auth.js-era rows stay in the table; their ids are not Hanko subs, so nothing matches them. The SQL was not edited.
- `$lib/server/db.ts` exports `db` as a lazy proxy plus `closeDb()`. Under Vitest it reads **only** `TEST_DB_CONNECTION` (no fallback to `DB_CONNECTION`), and `global-setup.ts` refuses to run when the two are equal, so the db tests can never wipe the dev DB. `global-setup.ts` drops and recreates the `public` and `drizzle` schemas before migrating, so every local run also migrates from zero.
- `db/test/reset.ts` is a Vitest `setupFiles` entry (truncate in `beforeEach`, `closeDb` in `afterAll`). It derives the table list from the schema barrel, so new tables are covered automatically.
- `db/scripts/lib/db.ts` throws when `DB_CONNECTION` is unset, because postgres-js would otherwise fall back to localhost. Scripts close their pool in `finally` instead of calling `process.exit(0)`.
- The `updateProfile` DB test found a bug: Drizzle 0.45 wraps driver errors in `DrizzleQueryError`, so `isUniqueViolation` never saw `code: '23505'` and a duplicate username threw (500) instead of returning `username-taken`. It now checks the error's `cause` chain.

---

## PR 4: `titles` spine, sources by reference, community tables

### Target schema (`db/schema/`)

Shared helpers in `db/schema/columns.ts`:

```ts
export const timestamps = () => ({
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});
export const umFlagColumns = () => ({
	noRape: boolean('no_rape').notNull() /* …8 more, one definition */
});
```

**`titles.ts`**

- `titleKind = pgEnum('title_kind', ['movie','tv'])`
- `titles`:
  - `id uuid pk`, `kind title_kind not null`;
  - `tmdbId int null`, `imdbId varchar null unique`;
  - `title varchar(255) not null`, `cleanTitle not null`;
  - `year int null` (null = unknown; **no 0 sentinel**);
  - `...timestamps()`;
  - `uniqueIndex('titles_kind_tmdb_idx').on(kind, tmdbId)`.
  - Postgres treats NULLs as distinct, so seeded rows without a TMDB id coexist. IMDb ids are globally unique across movies and series, so a plain unique works.

**`sources.ts`**

- `titleBechdel`: renamed from `movie_bechdel`, `title_id` pk/fk.
- `umSource`: unchanged columns, built via `umFlagColumns()`.
- `titleUm (titleId pk fk→titles cascade, umId fk→um_source.um_id, createdAt)`: a **binding only**. The flags are read through the join, so a UM reseed is reflected immediately and there is one row shape.

**`community.ts`** (replaces `community_metric_submissions` and `metric_kind`)

- `communityBechdelRatings (userId, titleId, rating smallint check 0..3, ...timestamps(), pk(userId,titleId), index(titleId))`.
- `communityUmReports (userId, titleId, ...umFlagColumns(), ...timestamps(), pk(userId,titleId), index(titleId))`.
  - **Decision: explicit booleans, not jsonb.** They match `um_source`, are typed end-to-end by Drizzle, and SQL can aggregate them (`avg(rape_on_screen::int)`) without JSON extraction.
- `communityDddVotes (userId, titleId, topicId int, season int null, episode int null, yes boolean, ...timestamps())`, with a unique constraint `unique('cdv_vote_uniq').on(userId, titleId, topicId, season, episode).nullsNotDistinct()` (a constraint, not `uniqueIndex`: Drizzle only exposes `nullsNotDistinct` on constraints; PG ≥ 15), plus `index(titleId, topicId)`.
- `comments`:
  - `id uuid`, `titleId fk`, `userId fk`;
  - `body text not null check (char_length(body) between 1 and 5000)`;
  - `status comment_status ('visible','hidden','deleted') default 'visible'`;
  - `...timestamps()`;
  - `index(titleId, createdAt)`, `index(userId, createdAt)`.
  - **No threads yet**: `parent_id` is a cheap additive migration when threads are actually designed.

**`auth.ts`**: `users` timestamps switch to `timestamps()`.

**Dropped:** `movie_trigger_tags`. **Decision:** DDD stays live and cached. Persisting third-party rows that go stale is the wrong shape. If persistence is ever needed, it will be a `ddd_snapshot (title_id, payload jsonb, fetched_at)` cache table.

### Migration `0002_titles_spine`

1. Generate with `db:generate`. When it asks whether `titles` was created or renamed from `movies` (and `title_bechdel` from `movie_bechdel`, `title_id` from `movie_id`), answer **rename** in each case.
2. Then hand-append the data statements to the generated SQL (allowed; the snapshot still matches the schema), placed after the rename and column changes and before the new constraints:

```sql
UPDATE titles SET kind = 'tv', tmdb_id = substring(imdb_id from 9)::int, imdb_id = NULL WHERE imdb_id LIKE 'tmdb-tv:%';
UPDATE titles SET tmdb_id = substring(imdb_id from 6)::int, imdb_id = NULL WHERE imdb_id LIKE 'tmdb:%';
UPDATE titles SET year = NULL WHERE year <= 0;
UPDATE um_source SET year = NULL WHERE year <= 0;
INSERT INTO title_um (title_id, um_id, created_at)
  SELECT mu.movie_id, mu.um_id, mu.created_at FROM movie_unconsenting mu JOIN um_source us USING (um_id);
-- timestamp → timestamptz: drizzle emits ALTER TYPE; add USING created_at AT TIME ZONE 'UTC'
```

Rename instead of drop/create because the `movies` and `movie_bechdel` data includes ~9.7k `tmdb_id`s backfilled through the rate-limited TMDB API (~40 min to redo). Test the migration on a copy of a seeded dev DB **and** from empty (CI does the latter).

### Data layer

- `$lib/server/data/media-queries.ts` → **`title-queries.ts`**:
  - `getTitleRow(kind, ref)`: read-only. Looks up by `(kind, tmdbId)`, falling back to `imdbId`. Deletes `getDbMovie`/`getDbMedia` and the `'0'` hack (review 2.4).
  - `getOrCreateTitleRow(kind, ref)`: the same lookup, plus a race-safe insert (`ON CONFLICT DO NOTHING RETURNING`, then select again), plus backfill of the missing id. Still unused by GET routes.
- `$lib/server/data/sources.ts`:
  - `getBechdel(titleId)`;
  - `getUmEntry(titleId)`: joins `title_um`→`um_source`, returns `UmEntry`;
  - `toUmEntry(row)`: the single mapper, used by `um-candidates.ts` too.
- Types: `UmCandidate` is renamed **`UmEntry`** (in `$lib/media/utils/metrics.ts`, re-exported from `$lib/media/types/um.ts`). It drops `flagCount` (derived via `umFlagCount`). `UnconsentingData` is deleted. `umMetricSection` props become `umData: UmEntry | null`.
- **Seeders**:
  - `seedMovies.ts` writes `titles` (`kind: 'movie'`) + `title_bechdel`.
  - `seedUnconsenting.ts` writes `um_source`, then only `(titleId, umId)` bindings. The 13 copied columns in its upsert disappear.
  - `backfillTmdb.ts` adds `where kind = 'movie'`.
  - `seedAdmin.ts` uses `db/scripts/lib/db`.

### Tests (DB project)

- **Regression for 2.4:** movie tmdb 1399 and tv tmdb 1399 coexist; inserting a second TV title succeeds.
- `getTitleRow`: prefers tmdb, falls back to imdb, and never writes (row count unchanged).
- `getOrCreateTitleRow`: backfills the missing id; two concurrent calls create one row.
- `getUmEntry`: reflects an updated `um_source` row without reseeding bindings.
- `getUnconsentingCandidates`: the existing disambiguation cases (exact year, unknown year, no match), now against real rows.
- Community constraints:
  - duplicate `(user,title)` rejected;
  - Bechdel 4 rejected;
  - a DDD vote with null season/episode is unique.
- Seeder smoke test: run `seedMovies` and `seedUnconsenting` on a 50-row CSV fixture.

**Status: done 2026-10-24** (code and local/CI verification). The pre-flight items (does a deployed DB exist; `comments` and `community_metric_submissions` empty there; `pg_dump` taken) are owner actions and are **not confirmed** by this PR; apply `0002` nowhere but a local or CI database until they are. Deviations and findings:

- **drizzle-kit bug.** 0.31.10 (and 0.31.11) crash in `preparePgAlterColumns` when one `generate` both renames a table and alters its columns: it reads the previous snapshot under the _new_ table name. The value it wants there only decides whether the old column type was an enum, and none of the altered columns on `titles`/`title_bechdel` were. The migration was generated with that one lookup optional-chained in the local `node_modules` (never committed); the stock package was then reinstalled, and the stock drift check reports no changes. SQL, snapshot and journal are drizzle-kit output; no snapshot was hand-edited.
- **Hand edits beyond appending**, all in the SQL only: `ADD COLUMN "kind" … NOT NULL` gets a temporary `DEFAULT 'movie'` (the generated form fails on a populated table), dropped at the end of the data block; `DROP TABLE "movie_unconsenting"` (and its `DISABLE ROW LEVEL SECURITY`) is moved below the data block, because drizzle-kit emits the drops before the renames; the `title_um` copy converts `movie_unconsenting.created_at` with `AT TIME ZONE 'UTC'`.
- **`community_ddd_votes` has a surrogate `id uuid` PK.** The plan names no PK, and nullable `season`/`episode` can't be part of one; uniqueness is the `cdv_vote_uniq` NULLS NOT DISTINCT constraint as planned.
- `getTitleRow` filters the `imdb_id` fallback by `kind` too, so a TV page can never pick up a movie row.
- `getOrCreateTitleRow`'s backfill writes only null columns and leaves an id alone if another row already owns it (catches 23505). `isUniqueViolation` moved to `$lib/server/data/pg-errors.ts` (shared with `user-queries.ts`).
- `timestamps()`' `$onUpdate` would bump `user.updated_at` on the JIT email backfill; it pins the column (``updatedAt: sql`${users.updatedAt}` ``) so the existing "no bump" test stays green. `updateProfile` relies on `$onUpdate` instead of setting `updatedAt`.
- `/user/metrics` read `community_metric_submissions`: `getUserSubmissions` became `getUserRatings` (Bechdel ratings + UM reports, joined to `titles`). `/user/comments` joins `titles`. Both link with `titleHref(kind, tmdbId)`; they used to link to `/movie/<uuid>`, which never resolved. DDD votes aren't listed (that's feature work).
- `seedUnconsenting(db, csvPath, reportPath?)`: the optional report path lets the smoke test avoid rewriting `unconsenting_unmatched.txt`. `seedAdmin.ts` already used `db/scripts/lib/db` (PR 3).
- The UM Disambiguation table in `architecture.md` said "no candidate shares the year → `[]`"; the code returns the unknown-year entries first. The doc now matches the code (no behaviour change).
- Behaviour change only on hand-made data: a `tmdb-tv:` row with a `movie_unconsenting` binding now shows the bound `um_source` entry (its copied flags are gone, by design), and is found even when TMDB returns an IMDb id for the series (the old `imdbId ?? 'tmdb-tv:…'` lookup missed it). Seeders never create TV bindings, so seeded data renders the same.

---

## PR 5: Module consolidation (no behaviour change)

1. **Shared constants**:
   - `$lib/media/utils/departments.ts` exports `PRIORITY_DEPARTMENTS`, imported by the TMDB mappers and `verdict.ts`. Delete `CREW_SCORED_DEPARTMENTS` and its "keep in sync" comment.
   - `$lib/media/utils/avatars.ts`: `AVATAR_DEFS = [{ key, name }]` and `AVATAR_KEYS`. The component folder keeps only a `key → Component` map. `user-queries.ts` imports the util, so no `.svelte` reaches the server data layer.
   - `normalizeTitle.ts` moves to **`db/lib/normalizeTitle.ts`**:
     - seeders import it relatively; the app uses `$db/lib/normalizeTitle`;
     - its spec moves to `db/lib/__tests__/`;
     - add `db/**/*.spec.ts` to the unit project's `include`;
     - `checkCsvColumns` stays in `db/scripts/lib` (script-only).
2. **TMDB integration** (`$lib/server/integrations/tmdb/`):
   - `client.ts`: `tmdbFetch(path, params)` with headers, error mapping and `getCached`.
   - `mappers.ts` (pure, unit-tested): `aggregateGender`, `buildCastMembers`, `buildCrewDepartments`, `mapMediaDetail(data, kind)`, `mapMovie`, `mapSeries`, `mapSearchResults`.
   - `index.ts`: `getMovie(id)`, `getSeries(id)`, `searchTitles(q)`.
   - **Delete** `routes/movie/[movieId]/datasource.server.ts`, `routes/tv/[seriesId]/datasource.server.ts` and `routes/api/search/datasource.server.ts`. Route folders become just `+page.*`/`+server.ts`.
   - Update AGENTS.md: "route folders hold only `+page.svelte`/`+page.server.ts`/`+server.ts`".
3. **One loader** `$lib/server/titles/load-title.ts`:
   ```ts
   export async function loadTitle(kind: TitleKind, tmdbId: string) {
   	const media = kind === 'movie' ? await getMovie(tmdbId) : await getSeries(tmdbId);
   	const row = await getTitleRow(kind, media);
   	const [bechdel, um] = row
   		? await Promise.all([kind === 'movie' ? getBechdel(row.id) : null, getUmEntry(row.id)])
   		: [null, null];
   	const umCandidates = um ? [] : await getUnconsentingCandidates(media);
   	const triggerTags =
   		kind === 'movie' ? getTriggerTagsLive(media.imdbId) : getTriggerTagsForSeries(media); // streamed
   	return { media, bechdel, um, umCandidates, triggerTags };
   }
   ```
   Each `+page.server.ts` becomes `setHeaders({ 'cache-control': PUBLIC_PAGE }); return loadTitle('movie', params.movieId);`.
4. **Client page state** `$lib/media/utils/titleView.svelte.ts`:
   - `class TitleView`, built from `() => data` and `kind`;
   - owns `selectedUm` (reset on title change), `umData`, `hasUmCandidates`, `flagCount`, the DDD stream (wrapping `createDddState`), `safety` and `representation`, all as `$derived`.
   - `episodeFilter.svelte.ts` owns the TV season/episode selection and `visibleTags`.
   - The two `+page.svelte` files keep only markup and their page-specific sections (Bechdel ladder for movies, episode selector for TV).
   - Keep the existing `.criterion-*` styles where they are; AGENTS.md references them.
5. **Verification for a no-behaviour-change refactor:**
   - Before starting, capture Playwright screenshots (light and dark, 375 px and 1280 px) of `/movie/603`, `/tv/1399` and `/`. Diff them after the change.
   - Run the existing `verdict.spec.ts` unchanged.
   - Add unit tests for the mappers (snapshot of a recorded TMDB fixture JSON in `__tests__/fixtures/`) and for `TitleView` derivations.

**Status: done 2026-10-24.** No visible behaviour change and no schema change (drift check clean). Verified against a local TMDB/DDD stub serving the same fixtures to a `main` build and a branch build, on the same seeded DB: full-page screenshots of `/`, `/movie/603`, `/tv/1399` (plus `/movie/992`, a seeded UM binding, and `/movie/900001`, the UM picker) in light/dark at 375/1280 px are pixel-identical (with Playwright's `animations: 'disabled'`; the comments skeleton shimmer otherwise differs run to run, on either build), as are the visible text (also after a UM pick and a season/episode pick) and `/api/search`. Not checked: real TMDB/DDD responses (no keys) and signed-in pages. Deviations and notes:

- **Page data keys.** Both pages now return `{ media, bechdel, umEntry, umCandidates, triggerTags }` (the plan's sketch): `movie`/`series` became `media`, and TV carries `bechdel: null`. The UM field keeps PR 4's name, `umEntry`. Decoded `__data.json` values are otherwise identical.
- **Cache keys unchanged** (`tmdb:movie:v2:<id>`, `tmdb:series:v2:<id>`, 24 h): the mapped shape is the same, so cached entries stay valid. Search stays uncached (PR 6).
- **`searchTitles` error path.** `tmdbFetch` throws an `HttpError`; `searchTitles` catches only that, logs and returns `[]` as `search()` did. A network failure still propagates to `/api/search`, which already answers `{ results: [] }`.
- **`selectedUm` and the episode selection** are writable `$derived`s keyed on the title id instead of `$state` + a reset `$effect`, so the pages lose two effects. `createDddState`'s effect is the only one left, as before.
- **`loadTitle` is overloaded** (`'movie'` → `Movie`, `'tv'` → `Series`) and passes the DDD call in per kind, so no cast is needed. Unit-tested with mocks (`titles/__tests__/load-title.spec.ts`), including that it never calls `getOrCreateTitleRow`.
- **Avatars.** `components/user/avatars/avatars.ts` keeps only `AVATAR_COMPONENTS`; `Avatar`/`AvatarPicker` read `AVATAR_DEFS` from the util. In the server build `user-queries.js` now imports a plain-data chunk (no `<svg>`, no Svelte runtime); the icon components are reached only from the `/user/profile` page SSR entry, which renders them.
- **TMDB fixtures are trimmed reconstructions**, not live recordings: no TMDB token was available. They follow the real `/3/movie/603`, `/3/tv/1399` and `/3/search/multi` response shapes, cut down to the fields the mappers read (plus a few they ignore), with no profile paths or other personal data.
- **AGENTS.md** gains a "define a constant once" rule (`$lib/media/utils/` for shared plain data, `db/lib/` for seeder + app code).
- The detail-page markup duplicated between the two pages (summary chips, `#gender` section, their styles) stays as is: the plan keeps markup in the pages, and extracting components would be a visible-structure change outside this PR.

---

## PR 6: Dependencies, search, dead code

1. **Package manager**:
   - `vercel.json` → `{ "installCommand": "bun install --frozen-lockfile", "buildCommand": "bun run build" }`;
   - `"packageManager": "bun@<current>"` in `package.json`.
   - If `--legacy-peer-deps` was masking a real peer conflict, resolve it by upgrading the offender, not by an override.
2. **Pin `latest`**: `@playwright/test`, `jsdom` and `@types/jsdom` get `^<installed version>`.
3. **Remove deps:**
   - `rxjs`: replaced by `$lib/media/utils/debouncedQuery.svelte.ts` (timer + `AbortController` that cancels the stale `fetch`), used by `MovieSearchState`. Delete `$lib/stores/debounced.ts` (and the `stores/` folder).
   - `nanoid`: replaced by Svelte's `$props.id()` (SSR-stable, Svelte 5.56 installed) in `radioTile`, `checkboxTile` and `AvatarPicker`.
   - `nodemailer`, `@sveltejs/adapter-auto`, and `jest-dom` (the stray v4 package; the spec uses `@testing-library/jest-dom`).
4. **Search**:
   - `searchTitles` goes through `getCached('tmdb:search:v1:' + q.toLowerCase(), 10 min)`.
   - `/api/search` responds with `cache-control: public, max-age=60, s-maxage=600`. It is user-agnostic, so the CDN absorbs repeated queries.
   - Add a 120-character query cap.
5. **Rate limiting** `$lib/server/http/rate-limit.ts`:
   - Add `incr(key, ttlMs): Promise<number>` to the cache `Backend` interface: a Map counter in memory, `INCR` + `PEXPIRE` in Redis.
   - `rateLimit(event, bucket, limit, windowMs)` keys on `event.getClientAddress()` (or the user id when known) and throws `error(429)`.
   - Apply to `/api/search` (60/min/IP) and `/user/profile/availability` (30/min/user).
   - Document that the in-memory backend is per-instance (best-effort on serverless) and that `REDIS_URL` makes it global.
6. **Delete orphans:**
   - `ui/tile/processTileGrid.svelte` + story;
   - `movies/metrics/metricsFrame.svelte`;
   - `movies/sections/sectionSkeleton.svelte`;
   - `landing/topBar.svelte`;
   - `components/navigation/{item,simple}.svelte`.

   Remove the "No orphan revival" rule from AGENTS.md (git history is the archive).

7. Delete `_testExports` from `ddd.ts`; tests call `clearCache()` directly.

**Status: done 2026-10-25.** No schema change (drift check clean). No visible behaviour change beyond the three the plan names (search caching headers, the 120-character cap, 429s). Verified against the PR 5 fetch stub (TMDB/DDD fixtures served in-process to a `main` build and a branch build, same seeded DB): full-page screenshots of `/`, `/movie/603`, `/tv/1399` in light/dark at 375/1280 px are pixel-identical (`animations: 'disabled'`), as are the visible text and `__data.json`. Screenshots of the landing and navbar search with a typed query and the results dropdown differ by at most 2/255 in one channel on a few anti-aliased rounded corners (`main` against itself: 1/255). `/api/search` bodies are identical; only the new `cache-control` differs. No hydration-mismatch warnings in a dev build on `/`, `/movie/603`, `/tv/1399`, `/resources` or `/user/profile` (signed in with a locally signed Hanko-shaped JWT and a stubbed JWKS); the avatar ids are now identical in SSR and hydrated markup (`main`'s nanoid ids changed on hydration). Redis checked locally (counter + TTL, a second instance sees the same limit, fail-open when Redis is down). Not checked: real TMDB/DDD responses, a hosted Redis, Vercel's install. Deviations and notes:

- **Peer conflict.** `--legacy-peer-deps` was hiding a real one: Storybook 9.1 (`@storybook/sveltekit`, `svelte-vite`, `builder-vite`) peers on `vite` ^5–7 and `@sveltejs/vite-plugin-svelte` ^2–6; the repo runs Vite 8 and vite-plugin-svelte 7. Fixed by upgrading Storybook to 10.6 (addon-svelte-csf 5.1.5); no config change, `build-storybook` builds the same stories. `eslint-plugin-storybook` was not loaded by `eslint.config.js`, so it was removed instead of upgraded. Left as is: `vite`'s optional `yaml@^2` peer, with `yaml@1` hoisted from `eslint-plugin-svelte` → `postcss-load-config` (no newer release changes that, and nothing loads a YAML config). npm 10 itself crashes resolving this tree strictly (`Cannot read properties of null (reading 'edgesOut')` in arborist's peer-set code), one more reason to stay on Bun.
- **nanoid had three more users** than the plan listed (`movieSearch` and `navbarSearch` listbox ids, `navbarMenu` menu id); all six use `$props.id()`. `nanoid@3` stays in `bun.lock` only as `postcss`'s own dependency.
- **`DebouncedQuery` API**: `new DebouncedQuery(source(query, signal), onResult, { empty, delayMs = 500 })` with `push`/`cancel`. It holds no runes (`.svelte.ts` per the plan). RxJS's `distinctUntilChanged` is gone on purpose: settling on the same query again (type a character, delete it) used to skip the fetch after `search()` had already cleared the rows, leaving a spinner forever. `fetchResults` returns `[]` on a non-OK response (a 429 used to throw on `data.results`), and a rejected fetch ends in "no results" instead of killing the stream.
- **Profile username check** also uses `DebouncedQuery` (400 ms, unchanged): a slow answer for an older value can no longer overwrite the current one, and an error response (e.g. a 429) shows nothing instead of "Already taken". A whitespace-only value now shows nothing instead of "Available".
- **`searchTitles` throws on a TMDB error** (PR 5 had it return `[]`). Returning `[]` from inside the cached fetcher would cache the outage for 10 minutes, and returning it outside would still let `/api/search` send the public header and the CDN cache it. Now the error escapes `getCached` (nothing stored) and `/api/search`'s catch answers `{ results: [] }` without `cache-control`.
- **Query cap: truncate.** `SEARCH_QUERY_MAX_LENGTH = 120` in `$lib/media/utils/search.ts`, used as `maxlength` by both search inputs and by the endpoint (trim, then slice).
- **Counters** get their own bounded `Map` in the memory backend (`MAX_COUNTERS = 10_000`), so they never evict cached responses. `rateLimit` takes the user id as an optional fifth argument (`{ userId }`); `/api/search` counts only non-empty queries.
- **`_testExports`** had 8 call sites in `ddd.spec.ts`, not 5.
- **Left for later**: `ui/form/linkButton` and `ui/feedback/skeleton` lost their last (orphaned) users with this PR, and `ui/text/{block,tooltip}` and `ui/visualization/progressbar` were already unused. They are library primitives, not on this plan's orphan list, so they stay. `e2e-tests/landing.spec.ts` "hero headline and search input are visible" fails on `main` and on this branch alike (it looks for the placeholder `Search...`; the input says `Search movies & TV…`); CI skips `e2e`, so nobody saw it.

---

## PR 7: Docs sweep

- **`.CLAUDE/architecture.md`:**
  - Bump the snapshot date.
  - Rewrite these sections: Database schema (`titles`/sources/community), Migrations, Auth flow (lazy `getUser`, `/api/me`, `session` rune, guards), Configuration & environment (runtime `DB_CONNECTION`, `.env.example`, compose URL), Directory layout, Server cache (`incr`).
  - Add "Caching policy" and "Testing" (unit / db / e2e) sections.
  - Remove the stale "dev/boot also runs migrations via hooks.server.ts".
  - Replace the per-change "verification baseline after X" log with a single current baseline.
  - Close Known gaps 1, 2 and 4.
- **`AGENTS.md`:**
  - **Route folders:** no `datasource.server.ts`.
  - **Server/client boundary:** never return a `UserRow` from a load; use `PublicUser`. Pages using `PUBLIC_PAGE` must not depend on the request's user.
  - **Database:** every schema change ships its generated migration in the same PR (CI enforces); `timestamps()` / `umFlagColumns()` helpers; `getTitleRow` vs `getOrCreateTitleRow`.
  - **Testing:** `*.db.spec.ts` for anything touching Postgres; `bun run test:db` joins the verification baseline (with `docker compose up -d db`).
  - Data-layer split names: `title-queries.ts`, `sources.ts`, `um-candidates.ts`.
- Mark `plan-architecture-review.md` and this plan as implemented, with dates.

---

## Verification baseline (every PR)

`bun run check` → 0 errors · `bun run lint` → clean (from PR 1) · `bun run test:unit` → all pass · `bun run test:db` → all pass (from PR 3) · `bun run build` → clean · CI green.

## Rollback

- PRs 1–3 and 5–7 are code-only, or additive, and revert cleanly.
- PR 4's migration is not reversible by revert. To roll back, restore the pre-flight `pg_dump` and redeploy the previous commit. That is why the dump is a hard prerequisite and the migration is rehearsed on a seeded copy first.
