# Plan: SvelteKit 3 on Cloudflare + D1, Better Auth (SSO + passkeys), comments with AI moderation

> The live plan. Its phases are the rows of `docs/phases/STATUS.md`; the rules it changes live in `.claude/rules/` (`.claude/rules/authority.md` names the owners).

## Context

MIDB runs on Vercel with Postgres (postgres-js + Drizzle), Hanko for auth, and an in-memory/Redis cache. The owner wants:

- **Hosting:** Cloudflare Workers on **Workers Paid**, with production on a **custom domain in a Cloudflare zone**.
- **Database:** **D1**.
- **Framework:** **SvelteKit 3**, upgraded in the same change.
- **Auth:** **Google and Discord SSO plus passkeys**, through **Better Auth**. Passkey-only sign-up is allowed. There is no email/password and no email passcode.
- **Comments on films and series:**
  - threaded replies, edit and delete;
  - votes;
  - each user's comment history;
  - human moderation: reports, a review queue, mute and ban;
  - **tiered AI moderation** with **Claude Haiku 5.5**:
    - a clear comment is published;
    - a borderline one waits for review;
    - a severe one is rejected;
    - if the AI fails, the comment waits for review.
- **CDN:** the edge serves title pages, images and heavy upstream requests.
- **Everything else unchanged:** landing, search, the movie and TV pages with Bechdel/UM/DDD/TMDB data, resources, profile and avatars.
- **Deploys:** GitHub Actions.
- **Open source:** it will be published as a **new open-source repository** (Apache-2.0).
  - Git history and backward compatibility don't matter.
  - The data starts fresh: source tables are loaded by the daily source sync (Phase 2b), and no users carry over.

What exists today:

- `comments` table: no threading, never written.
- `/user/comments`: read-only.
- Hanko seam: `hooks.server.ts`, then `locals.getUser()`, then `guards.ts`.
- `PUBLIC_PAGE` cookie-blind CDN rule: title loads never read the user.
- `db` proxy in `$lib/server/db.ts`.

The guards, `/api/me`, `toPublicUser`, the session rune's state machine and the `/user` layout stay. Only what sits under them changes.

## Verified platform facts (checked 2026-11-11)

- **SvelteKit 3** (official migration guide: https://svelte.dev/docs/kit/migrating-to-sveltekit-3):
  - **Minimum versions:** Node 22.17, TypeScript 6, Svelte ≥ 5.57.1, Vite ^8.0.12, vite-plugin-svelte 7.
  - **Config:** `svelte.config.js` is removed; config moves into `sveltekit({...})` in `vite.config.ts`.
  - **Aliases:** `$lib` is replaced by **`#lib`**, declared in package.json `"imports"`, and imports need explicit extensions. `kit.alias` is deprecated, so `$db` becomes `#db/*` through `imports`.
  - **Modules:**
    - `$app/stores` is removed in favour of `$app/state`.
    - `$app/environment` becomes `$app/env`.
    - `$env/*` is deprecated in favour of `$app/env/private` / `$app/env/public`.
    - `$app/paths`: `base`, `assets` and `resolveRoute` are removed in favour of `resolve()` / `asset()`.
  - **Navigation:** `invalidateAll` becomes `refreshAll`; in `goto`, `replaceState` becomes `replace`.
  - **Errors:** `error(status, message: string, extra?)`. An external `redirect` needs `{ external: true }`. `handleError` receives every error.
  - **Responses:** `json()` / `text()` are deprecated; use `Response.json()` / `new Response()`.
  - **CSRF:** `csrf.checkOrigin` becomes `csrf.trustedOrigins`.
  - **Other:**
    - the cookie `path` defaults to `/`;
    - tsconfig extends `$app/tsconfig`;
    - params move to `src/params.ts` with `defineParams`;
    - `data-sveltekit-*="off"` becomes `false`.
  - **Codemod:** `npx sv migrate sveltekit-3` automates most of it.
- **adapter-cloudflare 8** (needs Kit 3, wrangler ≥ 4.118):
  - `platform` is removed. Bindings and `waitUntil` come from `import { env, waitUntil } from 'cloudflare:workers'`, which the adapter emulates in `vite dev` only. The built Worker writes the literal `cloudflare:workers` import, which Node's `vite preview` cannot load, so it runs locally with `wrangler dev` (`pnpm preview`).
  - `fs` does not work; use `read` from `$app/server`.
  - It no longer caches anything itself.
  - Wrangler config: `main: ".svelte-kit/cloudflare/_worker.js"`, `assets: { binding: "ASSETS", directory: ".svelte-kit/cloudflare" }`.
- **Workers Caching** (https://developers.cloudflare.com/workers/cache/) **is the CDN.**
  - **Enabling:** opt-in with `"cache": { "enabled": true }` in wrangler config (≥ 4.69). Cloudflare then serves hits **without invoking the Worker**, from a tiered cache.
  - **Cache key:** path plus query, plus the Worker version. **Cookies are not in the key.**
  - **Bypass:** responses with `Set-Cookie`, `private` or `no-store` are bypassed automatically.
  - **Headers:**
    - Precedence: `cloudflare-cdn-cache-control` > `cdn-cache-control` > `Cache-Control`.
    - `stale-while-revalidate` works with `max-age`, not with `s-maxage`.
  - **Danger:** a 200 with no cache header is cached for **2h** by default, so every non-public response must say `private, no-store`.
  - **Purge:** `cache.purge({ tags })` / `{ pathPrefixes }` from `cloudflare:workers`, keyed on the `Cache-Tag` response header. Purges propagate globally. Every hit is still billed as a Workers request; CPU is billed only on a miss.
- **Wrangler:** `compatibility_date` ≥ 2026-11-01. `nodejs_compat` stays listed explicitly, for ALS, Better Auth and the Anthropic SDK. Rate-limit bindings need wrangler ≥ 4.36.
- **Cache API** (`caches.default`, still in the runtime):
  - per data centre;
  - used only for the internal `getCached` store, never for page responses.
- **D1:**
  - Limits: **100 bound parameters per query**, 100 KB per statement, and 1,000 queries per invocation on Paid.
  - Transactions: `batch()` is atomic. There is no `BEGIN`, so Drizzle's `db.transaction()` fails; use `db.batch()`.
  - Migrations: `wrangler d1 migrations apply` applies each file atomically and stops on error. `migrations_dir` reads drizzle-kit files.
  - Foreign keys: always on, and `PRAGMA foreign_keys=OFF` is ignored. Use `PRAGMA defer_foreign_keys = on` if a future migration rebuilds a table.
  - Time Travel: 30 days on Paid.
  - UNIQUE errors: the message is `UNIQUE constraint failed`, in `DrizzleQueryError.cause`.
- **Remote scripts:**
  - Use `drizzle-orm/sqlite-proxy` over `POST /accounts/{acct}/d1/database/{db}/raw`. It takes `{sql, params}` or `{batch:[…]}` and returns positional rows.
  - drizzle-kit: `driver: 'd1-http'`, used for `generate` only. Wrangler applies migrations.
- **Better Auth 1.7.x:**
  - Passkeys come from `@better-auth/passkey` (`passkeyClient` from `@better-auth/passkey/client`).
  - **Passkey-only sign-up** is native: `registration: { requireSession: false, resolveUser, afterVerification }`, with client `addPasskey({ context, createSession: true })`.
  - We create the user in `afterVerification` via `ctx.context.internalAdapter.createUser`.
  - `user.email` is required and unique, so passkey-only users get `${id}@users.invalid` with `emailVerified: false`.
  - Linking Google or Discord to such a user means `linkSocial` while signed in, with `allowDifferentEmails: true`.
  - Better Auth's built-in rate limiter is per isolate on Workers, so it is off. Use `advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`.
  - Schema generator: `pnpm dlx auth generate --adapter drizzle --dialect sqlite`.
- **Rate-limit binding:**
  - Config: top-level `"ratelimits": [{ name, namespace_id, simple: { limit, period: 10|60 } }]`.
  - API: `await env.X.limit({ key })` returns `{ success }`.
  - Counts are kept per location and are eventually consistent.
- **Anthropic SDK 1.x:**
  - Supported on Workers with `nodejs_compat`.
  - Pass `apiKey` explicitly.
- **TMDB:**
  - Hotlinking and proxying are tolerated.
  - Caching beyond **6 months** is not allowed.
  - Attribution is required: the TMDB logo plus the "not endorsed or certified by TMDB" notice.
- **Not verified yet:**
  - whether `$app/env/private` is filled from the Worker env under adapter 8 (we read secrets through `cloudflare:workers`, so it doesn't matter);
  - Storybook 10's compatibility with Kit 3;
  - the Workers Caching plan requirement (we're on Paid either way).

## Fresh repository

- **One migration:** a single SQLite baseline, `db/migrations/0000_init.sql` with its snapshot and journal, generated once all schema work is final. Phases regenerate it (delete, then `db:generate`) rather than stacking migrations. The Postgres chain is deleted.
- **No shims:** every Hanko, Vercel, Postgres, Redis and docker artefact is removed.
- **Old plans:**
  - The plans finished before the docs standards are in `docs/plans/done/`; whether they move to the new repository is an open item in `docs/phases/STATUS.md`.
  - Plans whose decisions still hold stay.
- **Branch:** work is committed and pushed to `ccr-15978aa5-gk22gk`. The owner moves it to the new repo.

## Open-source constraints

- **Secrets:** none in the repo.
  - `wrangler.jsonc` holds only non-secret config: bindings, vars, and the canonical D1 ids, which are useless without a token.
  - Secrets go through `wrangler secret put` and GitHub secrets.
  - Local env is one gitignored `.env`, documented by `.env.example`. Adapter 8's platform proxy reads it through wrangler, which uses `.env` when no `.dev.vars` exists.
- **Contributors need no accounts.** This must work with no Cloudflare login, using local D1 in Miniflare:

  ```
  pnpm install && pnpm db:migrate:local && pnpm db:sync:all --local && pnpm dev
  ```

  - `db:sync:all` needs network but no keys for the UM and Bechdel sources. The TMDB `/find` backfill and the popularity step are skipped, with a notice, when `TMDB_API_TOKEN` is unset. `--fixtures` loads the small test fixtures instead, so `db:sync:all` also works offline.

  - Passkeys work on `localhost` with no secrets.
  - The Google and Discord buttons appear only when their credentials are set.
  - With no `ANTHROPIC_API_KEY`, comments go to `pending`. A dev-only `MODERATION_DEV_AUTO_APPROVE=1` overrides that, and only on localhost.
  - Tests need no secrets and no network.

- **CI and forks:**
  - Fork PRs run tests only.
  - Previews deploy from same-repo branches only.
  - `pull_request_target` is never used.
- **Moderation is public.** The prompt, policy and blocklist are public. The real defences are:
  - rate limits;
  - Turnstile on passkey sign-up;
  - the human queue;
  - holds triggered by reports;
  - bans.

  A private `MODERATION_EXTRA_TERMS` secret extends the blocklist at runtime.

- **Disclosure:** `/resources` gets a "Comments and moderation" part. It says what the AI checks, that the comment text, title and parent comment go to Anthropic (never the email), and what is automatic and what is reviewed by people. It mirrors `policy.ts`.
- **Repo files:**
  - Each phase updates `PRIVACY.md`, `SECURITY.md`, `ACCESSIBILITY.md` and `THIRD_PARTY_NOTICES.md` for what it changes: Cloudflare in place of Vercel, Better Auth and its cookies in place of Hanko, comments and their moderation through Anthropic, the daily source sync.
  - Add a "Deploy your own" section to the README.
  - Show the TMDB attribution (logo and notice) on the site, in the footer or on `/resources`. `THIRD_PARTY_NOTICES.md` already carries the notice.

## Phase 0: SvelteKit 3 upgrade (on the current stack, before anything else)

1. Upgrade to the latest Kit 2.x (≥ 2.62, so config can live in vite.config). Then run `npx sv migrate sveltekit-3` and finish by hand:
   - Bump the packages:
     - `@sveltejs/kit@^3`, `svelte@^5.57.1`, `vite@^8.0.12`, `typescript@~6.0.3` (the typecheck stays on `typescript7`, TypeScript 7);
     - `svelte-check`, `eslint-plugin-svelte`, `@testing-library/svelte` and `@storybook/sveltekit` to versions that support Kit 3;
     - if Storybook has none yet, keep `storybook`/`build-storybook` out of the baseline and say so in the report.
   - Move the `svelte.config.js` content (`preprocess`, the alias) into `sveltekit({...})` in `vite.config.ts`, then delete the file.
   - Change `$lib/…` to `#lib/….js` (explicit extensions) and `$db/*` to `#db/*`, with package.json `"imports": { "#lib": "./src/lib/index.ts", "#lib/*": "./src/lib/*", "#db/*": "./db/*" }`. This touches every file.
   - Change `$env/static|dynamic/*` to `$app/env/public|private`.
   - Change `$app/stores` to `$app/state`, and `$app/environment` to `$app/env`.
   - Change `json()` to `Response.json()`.
   - Change `error()` calls to string messages.
   - Change `goto(..., { invalidateAll })` (in `logoutButton`) to `refreshAll`.
   - Make tsconfig extend `$app/tsconfig`.
2. Rewrite the rules the upgrade breaks, in `.claude/rules/code-standards.md` (File organisation): "Use `#lib` and `#db`", the `.svelte.js` rune-import rule (check it still applies), and the `@reference` depth rule (unchanged).
3. Run the full baseline on the current Postgres stack and commit that on its own, so later failures can't be confused with upgrade fallout.

## Phase 1: Cloudflare platform

1. **Packages and config files.**
   - Configure `@sveltejs/adapter-cloudflare@^8` in `vite.config.ts`'s `sveltekit({ adapter })`.
   - Remove `@sveltejs/adapter-vercel` and `vercel.json`.
   - Add `wrangler@^4.118` and `@cloudflare/workers-types`.
2. **`wrangler.jsonc`:**
   - `main` and `assets` as adapter 8 expects;
   - `"cache": { "enabled": true }` (Workers Caching);
   - `compatibility_date: "2026-11-01"`, `compatibility_flags: ["nodejs_compat"]`;
   - `d1_databases: [{ binding: "DB", database_name: "midb", database_id, migrations_dir: "db/migrations" }]`;
   - `ratelimits`: `RL_SEARCH` 60/60, `RL_AVAILABILITY` 30/60, `RL_AUTH` 10/60, `RL_COMMENT` 5/60, `RL_VOTE` 30/60, `RL_REPORT` 10/60;
   - `vars`: `PUBLIC_ORIGIN`, `PUBLIC_TMDB_*`, `MODERATION_MODEL="claude-haiku-5-5"`, `PUBLIC_TURNSTILE_SITE_KEY`;
   - `env.preview` with its own D1 database.
3. **Types.**
   - Generate the `Env` types with `wrangler types`.
   - In `src/app.d.ts`, drop the `jose` types and `locals.claims`.
4. **Env access.**
   - New `#lib/server/env.ts` is the single typed accessor for secrets and bindings, over `import { env } from 'cloudflare:workers'`. Public vars come from `$app/env/public`.
   - Vitest aliases `cloudflare:workers` to a stub, `src/test/cloudflare-workers.stub.ts`. The stub exposes a mutable `env`, a recording `waitUntil` and a recording `cache.purge`, so unit tests can set and inspect them.
   - Move `TMDB_API_TOKEN` (`integrations/tmdb/client.ts:3`) and `DDD_API_KEY` (`integrations/ddd.ts:1`) off `$env/static/private`.
   - New secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `DISCORD_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, `MODERATION_EXTRA_TERMS`.
5. **App cache** (`src/lib/server/cache/index.ts`).
   - Keep `getCached` / `incr` / `clearCache`.
   - New backend: the Cache API, with synthetic keys `https://cache.midb.internal/<key>` and `max-age=<ttl>`, behind a per-isolate memory L1.
   - The memory backend stays for tests, and for when `caches` is missing.
   - Delete Redis and `REDIS_URL`.
6. **Rate limits** (`src/lib/server/http/rate-limit.ts`).
   - Change it to `rateLimit(event, bucket, { userId? })`, where `bucket` names a binding.
   - Fallback: the memory `incr` with a limits table, for dev and tests.
   - Still fails open, and still throws 429 outside any `try`.
   - Update the callers: `/api/search` and `profile/availability`.
7. **CDN: Workers Caching.** Cloudflare serves hits before the Worker runs. Our code only sets headers.
   - **Cache policies.** `http/cache.ts` turns its policies into header sets: a browser `Cache-Control` plus an edge `CDN-Cache-Control`. `setHeaders` spreads the set.
     - `PUBLIC_PAGE`: browser `public, max-age=0`; edge `max-age=3600, stale-while-revalidate=86400`. Used by the title pages, their `__data.json`, and resources.
     - `PUBLIC_SEARCH`: browser `max-age=60`; edge `max-age=600`.
     - `PUBLIC_COMMENTS`: browser `max-age=0`; edge `max-age=600, stale-while-revalidate=60`, plus `Cache-Tag: comments:<kind>:<tmdbId>`. Comment writes and moderation actions call `cache.purge({ tags: [...] })` in `waitUntil`; votes don't purge, so scores can trail by up to one TTL. A purge failure is logged and swallowed.
     - `PUBLIC_IMAGE`: `public, max-age=2592000` (30 days, under TMDB's 6 months).
     - Comments in the code say "Cloudflare Workers Caching, key = path+query, cookies ignored".
   - **Safe default, in `hooks.server.ts`'s `handle`.** This is required because Workers Caching caches a header-less 200 for 2h.
     - A response without `cache-control` gets `private, no-store`.
     - A response with `Set-Cookie` is forced to `private, no-store`.
     - Covered by a unit test.
   - **Signed-in readers** get the same cached public HTML. That is intended: the navbar hydrates from `/api/me`.
   - **Deploys:** a new Worker version starts with an empty cache, because the version is in the key. Keep it that way so a deploy never serves stale markup.
8. **Images.**
   - New route `src/routes/img/tmdb/[size]/[file]/+server.ts`:
     - sizes allow-listed to `w92|w200|w300|w400|w500|w780`;
     - files must match `^[A-Za-z0-9_-]+\.(jpg|png|webp)$`;
     - fetches `image.tmdb.org` and passes the content type through;
     - `PUBLIC_IMAGE`, so Workers Caching serves repeats without running the Worker.
   - Add a shared `$lib/media/utils/tmdbImage.ts` URL builder, used by `image.svelte` and `resultPoster.svelte`.
     - Drop the `original 700w` srcset entry (3× screens were pulling multi-MB originals) and cap at w780.
     - Add `width`/`height` (2:3), `fetchpriority="high"` on the detail poster, and `loading="lazy"` on thumbnails.
     - Set `PUBLIC_TMDB_IMAGE_URL=/img/tmdb`. Pointing it back at `image.tmdb.org` is a config change.
   - Self-host Inter Tight (`static/fonts`, `@font-face` in `app.css`) instead of Google Fonts (`src/app.html` L22-26).
9. **Heavy requests.**
   - **Landing:** keep `no-store` so the films stay random. Wrap `getPopularRatedFilms(100)` (Phase 2b) and `getCatalogueCounts()` in `getCached` (1h); the shuffle stays per request.
   - TMDB and DDD keep their TTLs.
   - **DDD:** a non-OK upstream is cached for 60s, not stored as `EMPTY` for 1h.

## Phase 2: SQLite / D1 data layer

1. **Schema** (`db/schema/*`), from `pgTable` to `sqliteTable`:
   - enums → `text({ enum })` + CHECK. Keep the exported tuples (`userRole`, `titleKind`, `commentStatus`).
   - uuid → `text().$defaultFn(() => crypto.randomUUID())`.
   - `timestamps()` → `integer({ mode: 'timestamp_ms' })` + `$defaultFn`/`$onUpdate`. Millisecond precision keeps the `updated_at` tests meaningful.
   - boolean → `integer({ mode: 'boolean' })`. `umFlagColumns()` stays the only source.
   - `cdv_vote_uniq` → a unique index on `(user_id, title_id, topic_id, coalesce(season,-1), coalesce(episode,-1))`.
   - `char_length` → `length`.
   - `lower(username)` unique stays (usernames are ASCII).
   - Replace `title_bechdel.num_votes` with `titles.popularity` / `popularity_at` plus an index (Phase 2b). Add `um_source.source_updated_at` and the `source_sync` table.
2. **Migrations.**
   - Delete `db/migrations/*`.
   - `drizzle.config.ts`: `dialect: 'sqlite'`. When remote credentials are set, use `driver: 'd1-http'`.
   - `db:generate` writes `0000_init`.
   - The CI `migrations` drift job is unchanged.
3. **Client.**
   - `db/client.ts` exports `createDb(d1)`, returning `drizzle(d1, { schema })`, and the type `Db = BaseSQLiteDatabase<'async', any, typeof schema>`, which both the D1 and the sqlite-proxy clients satisfy.
   - `src/lib/server/db.ts` keeps the lazy `db` Proxy, so callers don't change.
     - It resolves `env.DB` from `cloudflare:workers` (production, plus dev through adapter 8's emulation). D1 is a binding, not a socket, so a module-level client is fine.
     - `bindDb(d1)` overrides that for tests and scripts.
     - It throws when there is no binding. There is no build-time connection string.
   - Rewrite `src/lib/server/__tests__/db.spec.ts`.
4. **Data.**
   - `pg-errors.ts` → `db-errors.ts`. `isUniqueViolation` matches `/UNIQUE constraint failed/` on `cause?.message ?? message`. Update its importers.
   - Every `inArray` and bulk write is chunked to stay at or under 100 parameters, through a shared, unit-tested `chunkForD1(rows, columns)` in `db/lib/`.
   - The remaining modules are already portable. Recheck `.returning()` and `onConflictDoNothing()`.
5. **Scripts.**
   - `db/scripts/lib/db.ts` → `openScriptDb()`:
     - by default, local D1 via `getPlatformProxy()`;
     - with `--remote`, sqlite-proxy over `/raw` (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`).
   - The CSV seeders are replaced by the Phase 2b sync scripts, which use `chunkForD1` + `db.batch`, `new Date()` instead of `now()`, and the `excluded.*` upserts.
   - `seedAdmin.ts` takes `--username` or `--email`.
   - Package scripts: `db:migrate:local` / `db:migrate:remote` (wrangler).
   - The scripts run on Node's type stripping (`node --env-file-if-exists=.env db/scripts/…`), with explicit `.ts` import extensions and `isMain` (`scripts/lib/is-main.ts`) as the entry-point check.
   - Delete `migrate.ts`, `migrateOnDeploy.ts` and its spec, and `docker-compose.yml`.
   - Remove `csv-parse` (the sync scripts read JSON/HTML/NDJSON, see Phase 2b).
6. **DB tests** (`pnpm test:db`, no docker).
   - `globalSetup`: wipe `.wrangler/test-state`, then `wrangler d1 migrations apply DB --local --persist-to .wrangler/test-state`. This proves the baseline applies from zero.
   - `setupFiles`: `getPlatformProxy({ persist: { path } })`, then `bindDb(env.DB)`; `dispose()` runs in `afterAll`.
   - Reset: `DELETE FROM` in FK order.
   - Port the Postgres-only assertions:
     - `xmin` "never writes" checks → a test-only `AFTER UPDATE` trigger counting writes;
     - `count(*)::int` → `count(*)`;
     - NULLS NOT DISTINCT → the coalesce index.
   - Drop `TEST_DB_CONNECTION`.

## Phase 2b: Daily source sync (Bechdel Test, Unconsenting Media, popularity)

DDD and TMDB are already fetched live. Bechdel and UM are static CSV snapshots today. Here they become **daily syncs**, and the snapshots are deleted.

**What each source offers (checked 2026-11-12):**

- **Unconsenting Media: `https://www.unconsentingmedia.org/list.json`**
  - What it is: public, about 26 MB, an array of all 16,291 items.
  - Fields: the same 71 as the current seed CSV — `id`, `name`, `cleanName`, `itemType`, `yearOfRelease`, `comment`, the 9 flags, the genre booleans, `createdAt`, `updatedAt`.
    - The existing seed was a CSV conversion of this feed (newest `updatedAt` 2026-06-01).
    - The live feed's newest `updatedAt` is 2026-11-09.
  - No IMDb or TMDB ids, so matching stays title + year (`normalizeTitle` / `um-candidates`).
  - `robots.txt` allows everything. No terms of use are published.
  - Courtesy: one request a day, an identifying User-Agent (`MIDB-sync (+repo URL)`), attribution on `/resources` and in the UM section's "Source:" link, and a note to the UM team via `/contactus` describing the use. Ask them whether they'd add IMDb ids.
- **Bechdel Test: the JSON API is gone.** `/api/v1/*` returns **410 Gone**. What remains is public HTML:
  - `https://bechdeltest.com/year/<YYYY>/`, one page per year. Each row carries the IMDb id (`imdb.com/title/tt…`), the bechdeltest id (`/view/<id>/`), the rating (`alt="[0-3]"`) and the title.
  - `https://bechdeltest.com/rss/`: the last 50 added films (title, year, `/view/<id>`, "Passed N of 3"), with dates.
  - `robots.txt`: `User-agent: *` allowed, `Content-Signal: search=yes, ai-train=no`. A sync bot is not AI training.
  - Data licence: **CC BY-NC 3.0**, which requires attribution and non-commercial use. MIDB qualifies, and `/resources` states the licence.
- **Popularity** (replaces the CSV's IMDb `numVotes`, used only to rank the landing films):
  - Source: **TMDB's daily export** `https://files.tmdb.org/p/exports/movie_ids_MM_DD_YYYY.json.gz`. It is newline-delimited JSON with `id` and `popularity`, needs no auth, and is ready by 08:00 UTC.
  - IMDb's datasets are ruled out: their licence forbids building a public database.
  - Schema change: drop `title_bechdel.num_votes` and add `titles.popularity` (real, nullable) and `titles.popularity_at`. `getMostVotedRatedFilms` becomes `getPopularRatedFilms`, ordered by `popularity`. The `num_votes` index becomes a `popularity` index.

**Implementation**

1. **Pure parsers** in `db/lib/sources/`, shared by scripts and tests, unit-tested against saved fixtures in `db/test/fixtures/` (trimmed real responses):
   - `um-feed.ts`: `parseUmFeed(json)` returns `UmSourceRow[]`. It validates with zod, keeps only `itemType ∈ movie|TV show`, and maps the 9 flags through `umFlagColumns`. `source_updated_at` comes from `updatedAt`.
   - `bechdel-html.ts`: `parseBechdelYearPage(html, year)` returns `{ bechdelId, imdbId, title, year, rating }[]`. `parseBechdelRss(xml)` returns the ids and years of recent additions.
   - `tmdb-export.ts`: a streaming NDJSON reader that yields `{ id, popularity }`.
   - All selectors and regexes live in one place. When a parser finds zero rows, the sync fails loudly instead of deleting data.
2. **Sync scripts** (`db/scripts/sync/*.ts`). They use `openScriptDb({ remote })` and write through `chunkForD1` + `db.batch`. They are idempotent and diff-based, writing only changed rows.
   - `sync-um.ts`:
     1. fetch `list.json`;
     2. upsert `um_source` rows whose `updatedAt` is newer than the stored `source_updated_at`;
     3. delete rows missing from the feed, removing their `title_um` bindings first (`um_id` FK is NO ACTION);
     4. re-run the existing binding step (`seedUnconsenting`'s matcher) for new or renamed items.

     It also writes the unmatched report to the job log, not the repo.

   - `sync-bechdel.ts`:
     - **Daily:** the RSS feed plus the year pages for the current year and the two before it.
     - **Weekly (Sundays):** the full sweep, every year page from 1874 to now (about 150 requests, 1 per second).
     - It upserts `titles` (movie, `imdb_id`, title, year) and `title_bechdel` (`bechdel_id`, rating).
     - New titles get their `tmdb_id` through `backfillTmdb` (TMDB `/find`).
   - `sync-popularity.ts`: stream today's TMDB movie and TV export files and update `titles.popularity` for titles that have a `tmdb_id`. Only rows we hold are written: the export is read, not stored.
   - Every request uses the `MIDB-sync` User-Agent, a timeout, and one retry. On a fetch or parse failure the job exits non-zero and changes nothing.

3. **First load in a fresh database** runs the same scripts. `pnpm db:sync:all --local|--remote` replaces `db:seed:movies` / `db:seed:um`.
   - Delete `db/seeds/sources/*.csv` and `unconsenting_unmatched.txt`.
   - Delete `seedMovies.ts` / `seedUnconsenting.ts`; their upsert and matching code moves into the sync scripts.
   - Delete the CSV readers (`checkCsvColumns.ts`, the `csv-parse` dependency).
   - Fixture-based db specs cover the sync (`db/scripts/__tests__/sync.db.spec.ts`).
4. **Schedule:** `.github/workflows/sync-sources.yml`, `cron: '23 9 * * *'` (after TMDB's 08:00 UTC export).
   - Steps: `db:sync:um --remote`, then `db:sync:bechdel --remote` (`--full` on Sundays), then `db:backfill:tmdb --remote`, then `db:sync:popularity --remote`.
   - Secrets: `CLOUDFLARE_*` for the D1 REST API, plus `TMDB_API_TOKEN`.
   - Runs only on the canonical repo (`if: github.repository == …`), never on forks.
   - GitHub disables schedules after 60 days with no repo activity. Document this in the README, and alert through workflow failure emails.
5. **Freshness in the app.** Title pages are cached at the edge for 1h and the landing query for 1h, so synced data shows within an hour.
   - Add `source_synced_at` per source in a small `source_sync` table (source, last_success_at, rows_changed).
   - Show it as "Updated <date>" next to each "Source:" link, which also makes the copy code-backed.
   - Moderators see a stale-sync warning on `/user/moderation` after 48h without a successful sync.

## Phase 3: Auth (Better Auth)

1. **Schema** (`db/schema/auth.ts`).
   - Generate `user`, `session`, `account`, `verification` and `passkey` with `pnpm dlx auth generate`, then merge.
   - `user` keeps `role`, `username` and `avatar_key` as `additionalFields` (`input: false`), and adds `banned_at`, `ban_reason` and `muted_until`.
   - A `realEmail(user)` helper hides `@users.invalid`. The email is still sent only to `/user/profile`.
2. **Server** (`src/lib/server/auth/auth.ts`). `getAuth()` is memoised per isolate:
   - `drizzleAdapter(db, { provider: 'sqlite', schema })`
   - `socialProviders.google` / `.discord`, included only when configured
   - `account.accountLinking: { enabled: true, trustedProviders: ['google','discord'], allowDifferentEmails: true, updateUserInfoOnLink: true }`
     - When linking replaces a placeholder email, adopt the provider's verified email.
   - `passkey({ rpID: new URL(PUBLIC_ORIGIN).hostname, rpName: 'MIDB', origin: PUBLIC_ORIGIN, registration: { requireSession: false, resolveUser, afterVerification } })`
     - `afterVerification` creates the user with the placeholder email and returns `userId`.
   - `captcha({ provider: 'cloudflare-turnstile', endpoints: ['/passkey/generate-register-options'] })`, skipped when no secret is set.
   - `session.cookieCache: { enabled: true, maxAge: 300 }`
   - `advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`
   - `rateLimit.enabled: false`. Instead, `RL_AUTH` keys on the IP and wraps the route.
   - `databaseHooks.session.create.before` throws `APIError FORBIDDEN` for banned users.
   - Banning also deletes the user's sessions. Write paths re-read the ban and mute state from the DB, because of the cookie cache.
3. **Routes.**
   - `src/routes/api/auth/[...all]/+server.ts` calls `getAuth().handler(request)`, with `PRIVATE_NO_STORE`.
   - Orphan users (no `account` and no `passkey` after 1h; D1 has no transaction around the passkey insert) are removed by a scheduled workflow running `db:cleanup:orphans --remote`.
4. **Hook.**
   - `locals.getUser()` stays lazy and memoised: `getAuth().api.getSession({ headers })`, returning `UserRow | null`. Banned users resolve to null.
   - The `/user` gate checks only that the session cookie exists. The `/user/moderation` role gate stays.
   - Public loads never call `getUser`.
   - Remove `locals.claims`.
5. **`user-queries.ts`.**
   - Delete `getOrCreateUser`.
   - Keep the rest.
   - `PublicUser` gains an opaque `id`, needed to recognise one's own comments in cookie-blind lists. Update the type doc, the `toPublicUser` / `api-me` specs and `.claude/rules/code-standards.md`, Server / client boundary.
6. **Client.**
   - Delete:
     - `components/auth/hanko*.svelte`
     - `routes/user/dashboard`
     - the `hanko-*` CSS in `app.css`
     - `@teamhanko/hanko-elements` and `jose`
     - `PUBLIC_HANKO_API_URL`, everywhere it appears
   - New `$lib/auth-client.ts`: `createAuthClient` + `passkeyClient`.
   - `/auth` page (CSR):
     - "Continue with Google" and "Continue with Discord" (`.btn--ink`, hidden when not configured)
     - "Sign in with a passkey" (`.btn--brand`, conditional-UI autofill)
     - "Create an account with a passkey" (Turnstile widget)
     - After signing in, the reader goes to `/user/profile`, which shows the existing "Set a username" prompt.
   - New `/user/security`, replacing `dashboard`: linked accounts and passkeys, with link, unlink, rename and delete. The last remaining sign-in method can't be removed.
   - `logoutButton.svelte` calls `authClient.signOut()`.
   - `session.svelte.ts`: replace `hasHankoCookie` with a readable, non-secret `midb_hint=1` marker. The client sets it on sign-in and clears it on sign-out or when `/api/me` returns null.
7. **Tests.**
   - Rewrite `hooks.server.spec.ts` with a mocked `getAuth`.
   - Update the hint tests in `session.spec.ts`.
   - Keep the guards, api-me and availability specs.
   - New db specs: placeholder email, `afterVerification` user creation, and the ban hook.

## Phase 4: Comments

1. **Schema** (`db/schema/community.ts`).
   - `comments` gains:
     - `parent_id` and `root_id` (self-FKs, cascade);
     - `status` ∈ `pending|published|hidden|rejected|deleted`;
     - `score`, `reply_count`, `edited_at`;
     - `moderation_source` ∈ `ai|blocklist|moderator|reports`;
     - `moderation_reason`;
     - `ai_verdict` (JSON text).
   - Indexes on `(title_id, status, created_at)`, `(title_id, status, score)`, `(root_id, created_at)` and `(user_id, created_at)`.
   - `comment_votes(comment_id, user_id, value ±1)`, PK on both ids.
   - `comment_reports(id, comment_id, reporter_id, reason ∈ hate|harassment|spam|sexual-content|threat|other, note, status ∈ open|resolved|dismissed, resolved_by, timestamps)`, unique on `(comment_id, reporter_id)`.
   - `moderation_actions(id, actor_id, target_comment_id?, target_user_id?, action, reason, created_at)`.
   - Threading: a root plus one rendered reply level. Deeper replies stay in the root's thread with "in reply to @name".
2. **Data** (`$lib/server/data/`).
   - `comment-queries.ts`:
     - `listTitleComments(titleId, { sort: 'top'|'new', cursor })` returns published roots plus their replies. Hidden or deleted comments that have replies come back as bodiless placeholders.
     - `getViewerCommentState(titleId, userId)`
     - `createComment`
     - `editComment`, which sets `edited_at` and re-runs moderation
     - `softDeleteComment`
   - `comment-votes.ts`: the vote row and the `score` delta are written in one `db.batch`.
   - `comment-reports.ts`: 3 distinct open reports move a published comment to `pending` (source `reports`).
   - `moderation-queries.ts`:
     - the queue;
     - approve, hide, reject, restore, dismiss, mute and ban;
     - each action writes `moderation_actions` in the same batch.
   - The first comment on a title calls `getOrCreateTitleRow`. GETs still use `getTitleRow` only.
3. **Endpoints** (JSON; the CORS preflight blocks cross-origin JSON POSTs, and the cookie is SameSite=Lax).
   - Every write runs, in order: `requireUser`, a mute and ban check against the DB, `rateLimit(…, { userId })`, then `zod` validation.
   - `GET /api/titles/[kind]/[tmdbId]/comments`: `PUBLIC_COMMENTS`, edge-cached, author `PublicUser` fields only.
   - `GET …/comments/viewer`: `PRIVATE_NO_STORE`, returns my votes plus my pending and rejected comments.
   - `POST …/comments` with `{ body, parentId? }`: returns the stored comment and its status.
   - `PATCH|DELETE /api/comments/[id]`: owner only.
   - `PUT|DELETE /api/comments/[id]/vote`: no voting on your own comment.
   - `POST /api/comments/[id]/report`
4. **UI** (`$lib/components/comments/`, designed through `/impeccable`, with `.claude/rules/copy-standards.md`).
   - Components:
     - `commentsSection.svelte`: a `CollapsibleSection` at the end of `.sections` on the movie and TV pages, with no icon disk;
     - `commentList`, `commentItem`, `commentComposer` and `commentReportForm`;
     - state in `commentsState.svelte.ts`, imported with `.js`.
   - The fetch starts on mount, into a reserved fixed-height `aria-busy` box.
   - Sort by top or newest. Votes use `ri-arrow-up-line` / `ri-arrow-down-line`, with a `tabular-nums` score.
   - Badges: `commentStatusTone` in `tones.ts` (pending → `mid` "Awaiting review"; rejected → `neg` plus the reason).
   - Signed-out readers see a "Sign in to comment" `.link`.
5. **`/user/comments`:** every status with its badge, a link to the title, inline edit and delete. It currently ignores `status`; fix that.
6. **`/user/moderation`:**
   - The load runs `requireRole`.
   - Tabs: Pending, Reported, Recent actions.
   - Each row shows the comment, its title, the AI categories, the reports, and the author's history count.
   - Form actions `?/approve|hide|reject|restore|dismiss|mute|ban`, each calling `requireRole`.

## Phase 5: AI moderation

1. **Client** (`integrations/anthropic.ts`): `new Anthropic({ apiKey, timeout: 8000, maxRetries: 1 })`.
2. **Blocklist** (`moderation/blocklist.ts`): normalised public terms plus `MODERATION_EXTRA_TERMS`. A hit rejects the comment with no API call.
3. **Classifier** (`moderation/classify.ts`).
   - `classifyComment({ body, titleName, kind, parentBody? })` calls `client.messages.parse` with:
     - `model: MODERATION_MODEL` (`claude-haiku-5-5`)
     - `max_tokens: 1024`
     - `thinking: { type: 'disabled' }`
     - `output_config: { effort: 'low', format: zodOutputFormat(Verdict) }`
   - `Verdict` = `{ decision: allow|review|reject, categories: (hate|misogyny|harassment|slur|threat|sexual-minors|sexual-explicit|doxxing|spam|survivor-mockery|off-topic)[], severity: 0–3, reason ≤140 chars }`.
   - The system prompt is frozen, and it states the site's purpose:
     - describing, quoting and criticising misogyny or sexual violence in films is allowed;
     - endorsing it, mocking survivors, attacking people, slurs, threats and spam are not.
   - The comment goes inside `<comment>` tags and is treated as data.
   - Checks before using a result:
     - check `stop_reason` before reading;
     - these all map to `review`: `refusal`, `max_tokens`, a null `parsed_output`, a timeout, and any API error;
     - SDK errors are caught most-specific first.
4. **Policy** (`moderation/policy.ts`, pure):
   - blocklist hit → `rejected`
   - `allow` → `published`
   - `review` or a failure → `pending`
   - `reject` with severity ≥ 2 → `rejected`
   - `reject` with severity < 2 → `pending`
5. **Cost guard:** `RL_COMMENT` at 5/min per user, bodies of 1–5000 characters, and moderation on create and edit only. At roughly 1k input and 100 output tokens, that is about $0.00015 per comment.
6. **Tests:** mock the SDK in every test; none calls the real API.

## Phase 6: CI, deploy, docs

1. **`tests.yml`:**
   - The `db` job drops its Postgres service and runs on local D1.
   - `e2e`: apply migrations locally, seed the fixtures, then `pnpm preview` (`wrangler dev`).
   - Fork PRs get no secrets.
2. **`deploy.yml`:**
   - On push to `main`:
     1. `wrangler d1 time-travel info midb` (log the bookmark);
     2. `wrangler d1 migrations apply midb --remote` (failure stops the deploy);
     3. `pnpm build && wrangler deploy`.
   - Same-repo PRs: migrate the preview DB, then `wrangler versions upload --env preview`.
   - A scheduled job runs the orphan-user cleanup.
   - Secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. **Docs:**
   - **`.claude/rules/` (code, deploy and docs standards, and `AGENTS.md`'s Commands):**
     - Database: D1, the `db` resolution, batches instead of transactions, the 100-parameter chunking, migrate-first through the workflow, and `defer_foreign_keys`.
     - Testing: local D1, no docker. Verification baseline: drop `docker compose`.
     - Server/client boundary: Better Auth, `PublicUser.id`, no `locals.claims`.
     - Caching: Workers Caching, cache header sets, `Cache-Tag` purges, and the hook's safe default (no header or `Set-Cookie` → `private, no-store`).
     - Aliases: `#lib`, `#db`.
     - Bindings: from `cloudflare:workers` through `#lib/server/env.ts`.
   - **`docs/architecture.md`:** file map, auth flow, caching policy, env table, and the comments and moderation sections. Remove the Hanko, Vercel, Postgres and Redis text.
   - **Other files:**
     - `README.md`: setup and "Deploy your own".
     - `DESIGN.md`: comment and moderation patterns; Hanko theming removed.
     - `PRODUCT.md`: new surfaces.
     - Add `SECURITY.md`.
     - Delete this plan once its last phase is completed (`.claude/rules/docs-standards.md`, Plans).

## Verification

- **Baseline after every phase:**
  - `pnpm check` → 0 errors
  - `pnpm typecheck` → 0 errors
  - `pnpm lint` clean
  - `pnpm test:unit`
  - `pnpm test:db` (local D1)
  - `pnpm build`, which produces the worker
- **New unit specs:**
  - hook safe default: a header-less response becomes `private, no-store`; a response with `Set-Cookie` is forced private
  - each cache header set is correct
  - comment writes purge the right `Cache-Tag`; votes don't
  - image route validation
  - rate-limit binding and its fallback
  - `chunkForD1`
  - moderation policy, plus `classify` with a mocked SDK (refusal, timeout, null parse), plus the blocklist
  - comment endpoints: 401, 403 when muted or banned, 429, owner-only edit, no self-vote
  - hooks with a mocked Better Auth
- **Source sync:**
  - parser unit specs against fixtures (UM feed, Bechdel year page and RSS, TMDB NDJSON);
  - a zero-rows result makes the sync fail without deleting anything;
  - `sync.db.spec.ts`: an upsert-only diff, UM deletions remove their bindings first, Bechdel upserts, the popularity update, and `source_sync` stamping;
  - one manual `db:sync:all --local` run against the live sources, reporting row counts against today's site totals (UM 16,291 items; Bechdel about 11k films).
- **New db specs:**
  - threading and reply counts
  - vote and score consistency through the batch
  - the report threshold
  - the moderation log
  - soft delete keeps replies
  - the public list excludes pending and rejected comments
- **End to end** (Playwright against `wrangler dev` after migrating and seeding locally):
  - landing, search, a film page and a series page match today's data;
  - check that title pages, `__data.json`, the comments list and images send the intended `Cache-Control` / `CDN-Cache-Control` / `Cache-Tag`, and that `/user/*`, `/api/me` and `/api/auth/*` send `private, no-store`;
  - Workers Caching isn't emulated locally. On the first preview deploy, check that a second request for a title page and for an image is a cache hit (Cloudflare's cache-status response header, with the Worker not invoked in `wrangler tail`), and that a new comment purges its list;
  - the poster loads from `/img/tmdb/w500/…`;
  - passkey sign-up and sign-in through a CDP virtual authenticator (`WebAuthn.addVirtualAuthenticator`);
  - the OAuth buttons redirect to the provider;
  - comment, reply, edit, vote and report all work;
  - with a mocked verdict, a pending comment is visible only to its author, and a moderator can approve it from `/user/moderation`.
  - Commit these as specs under `e2e-tests/`.
