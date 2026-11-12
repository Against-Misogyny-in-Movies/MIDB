# Code standards

Every agent that changes code follows these. `docs/architecture.md` says why and where each one is used; this file is the checklist. A reviewer reports a breach as a finding against the code. Styling rules are in `.claude/rules/style-standards.md`, copy rules in `.claude/rules/copy-standards.md`.

## Server / client boundary

- `#lib/server/**` is a hard SvelteKit boundary: nothing client-reachable may import from it. Secrets (`TMDB_API_TOKEN`, `DDD_API_KEY`, …) and all DB access live here only.
- To expose a server type to a client component, re-export it **as a type** from `#lib/media/types/*`. Type-only imports are erased at build and do not leak runtime server code. See `media/types/ddd.ts` → `integrations/ddd-types.ts` as the pattern.
- **Environment variables.** Public values and the dynamic DB variables are declared once in `src/env.ts` (`defineEnvVars`): client code imports the public ones from `$app/env/public`, server code the DB ones from `$app/env/private`. Secrets and bindings (D1, rate limits) are read only through `#lib/server/env.ts`, when a request needs them, never at module load. App code reads no setting from `process.env` (the test runner's `VITEST` flag excepted).
- `data/` = D1/Drizzle modules. `integrations/` = external HTTP clients.
- **Never return a `UserRow` from a load; pages using `PUBLIC_PAGE` must not depend on the request's user.**
  - The client gets `PublicUser` (`toPublicUser`) only, via `/api/me` or the `/user` layout. The email reaches the client on `/user/profile` alone.
  - Public pages (`PUBLIC_PAGE` from `#lib/server/http/cache.ts`) are CDN-cached with a cookie-blind key, so their loads never call `locals.getUser()` or read `locals.claims`.
  - The navbar reads the client session (`session.svelte.js`).
- **Authorize with the guards.** Every load, action and endpoint that needs a user calls `requireUser` / `requireRole` from `#lib/server/auth/guards.ts` (redirect for pages, 401/403 otherwise). The hook's `/user` gate is claims-only and does not cover form actions on public pages.
- **Rate-limit with `rateLimit`** (`#lib/server/http/rate-limit.ts`):
  - Pass `{ userId }` only when the route already ran `requireUser`; otherwise it keys on the client IP.
  - Never read the user just to key a limit on a public or CDN-cached route.
  - Call it outside any `try` that would swallow the 429.
  - `bucket` names a binding in `wrangler.jsonc`; a new limit adds the binding there, to `RateLimitBucket` and to its memory fallback in the same change.

## Route folders are thin

- Route folders (`src/routes/*/`) hold only `+page.svelte` / `+page.server.ts` / `+server.ts`. No `datasource.server.ts`.
  - External clients live in `#lib/server/integrations/` (TMDB: `integrations/tmdb/`).
  - The movie and TV pages share `loadTitle` (`#lib/server/titles/load-title.ts`) and `TitleView` (`#lib/media/utils/titleView.svelte.js`).
- Logic shared by two or more routes goes in `#lib/server/` (server) or `#lib/media/` (client-safe). Never put shared logic inside a route folder.

## File organisation

- **Use `#lib` and `#db`** for all cross-folder imports: the subpath imports in package.json (`#lib/*` → `src/lib/*`, `#db/*` → `db/*`), with the file's extension (`#lib/media/utils/format.ts`, `#lib/components/ui/badge.svelte`). Relative `./` is for same-folder siblings only.
- **The Node-run graph uses type stripping:** the entry points under `db/scripts/` and `scripts/` and what they import (`db/client.ts`, `db/schema/*`, `db/lib/*`, `db/test/global-setup.ts`), not Vitest specs.
  - It uses relative `.ts` imports instead of `#lib`/`#db`, so it does not depend on the app's imports map.
  - Those imports look like `from '../client.ts'`, and the graph uses erasable syntax only (no enums, namespaces or parameter properties); `erasableSyntaxOnly` in `tsconfig.json` enforces it.
  - An entry point is guarded with `isMain(import.meta.url)` (`scripts/lib/is-main.ts`), and a script that reads `.env` is run with `--env-file-if-exists=.env`.
- **One concern per file.** When a file mixes identity resolution, algorithm logic, and rendering, split it. Name files after what they do, not what they are adjacent to.
- **A file has one job.**
  - Past roughly 300 lines it needs a single reason to stay together.
  - Past 500 it is split along behaviour, not by an arbitrary line cut.
  - `scripts/checks/__tests__/file-size.spec.ts` holds the 500. It lists the files over it today; none of them may grow, and a listed file that drops back under the limit fails as stale.
- **Split along these lines for the data layer:**
  - Identity resolution → `server/data/title-queries.ts`; trivial seeded-metric fetches → `server/data/sources.ts`
  - Domain-specific query algorithms (e.g. UM disambiguation) → their own file (`um-candidates.ts`)
  - Public domain types with no runtime → `integrations/*-types.ts`, re-exported via `media/types/`
- **Define a constant once.**
  - Shared plain data lives in `#lib/media/utils/` (`departments.ts` `PRIORITY_DEPARTMENTS`, `avatars.ts` `AVATAR_DEFS`/`AVATAR_KEYS`), so server and client import the same value.
  - A `components/` module may hold only what needs components (the avatar key → component map).
  - Code shared by seeders and the app lives in `db/lib/` (`normalizeTitle.ts`), never in `db/scripts/`.
- **Rune modules** (`.svelte.ts`) are imported as `.svelte.js` (`import { x } from '#lib/media/utils/foo.svelte.js'`, or `./foo.svelte.js` beside it). The component of the same name is imported as `foo.svelte`; the explicit extension is what tells them apart.

## Components

- **`ui/` vs domain.**
  - Title-specific UI goes in domain folders (`movies/facts/`, `movies/sections/`, `movies/metrics/`, `movies/media/`, `landing/`, `search/`, …).
  - A generic primitive goes in `#lib/components/ui/*` only once it has two real consumers (today: `badge`). Don't build unused primitives ahead of need.
- **Components own their styles.** A component's CSS classes should not leak into parent pages. If the same visual pattern appears in two pages, extract a component rather than duplicating the stylesheet.
- **`@reference` depth.** `<style lang="postcss">` blocks need `@reference` pointing at `src/app.css`.
  - Count the folder depth: four `../` for components two levels deep under `movies/*`, `user/*` or `ui/*`; three for shallower ones (`layout/`, `search/`, `resources/`).
  - Wrong depth causes silent Tailwind resolution failures in unit tests.
- **Performance and smooth UX are a priority, especially above the fold.**
  - Never block first paint on client-streamed data (e.g. DDD via `dddStream.svelte.js`): render a provisional or `pending` state immediately and update it in place.
  - Reserve layout so streamed or async updates cause **zero layout shift**:
    - fixed-size slots;
    - summaries in a reserved clamped box (the verdict's two-line `line-clamp-2` + `min-height`);
    - values replaced in place (the source index);
    - no reflow of siblings.
  - Derive view state with `$derived` over already-loaded data (cheap, recomputes only on real input change). Avoid effects, DOM measurement, and extra requests for first-render UI.
  - Ease state changes with the shared `0.15s ease` transition, and gate every animation on `prefers-reduced-motion` (see `collapsibleSection.svelte`).
  - Use `aria-busy` for in-progress streaming states instead of spinners that shift layout.

## Database

- The DB layer lives in `db/` (outside `src/`), imported by app code as `#db/*`.
- **App code gets `db` from `#lib/server/db.ts` only.**
  - The database is Cloudflare D1, reached through the `DB` binding. `db` is a lazy proxy over `env.DB` that throws without a binding, so nothing touches the database at build time.
  - Tests and scripts attach a binding with `bindDb(d1)`; the app never builds its own client.
  - Scripts call `openScriptDb(target)` from `db/scripts/lib/db.ts` (local D1 by default, `--remote` over the Cloudflare API) and `close()` it when done. A script that writes takes `--local|--remote` through `parseTarget`.
- **D1 has no `BEGIN`.** `db.transaction()` fails: use `db.batch()` for writes that must be atomic.
- **A statement binds at most 100 parameters.** Every bulk write, and every `inArray` over a list that can grow, goes through `chunkForD1` (`db/lib/chunkForD1.ts`).
- **Foreign keys are always on.** A migration that rebuilds a table sets `PRAGMA defer_foreign_keys = on`.
- GET routes use the **read-only** resolver `getTitleRow(kind, ref)`: page visits must never mutate the DB.
- The write path `getOrCreateTitleRow(kind, ref)` is reserved for write endpoints (community ratings, comments).
- **Schema helpers:**
  - Timestamps are `integer` `timestamp_ms` via `timestamps()` from `db/schema/columns.ts`. Its `$onUpdate` bumps `updated_at` on every Drizzle update; pin it with ``updatedAt: sql`${col}` `` when a write is not an edit.
  - The nine UM flag columns come from `umFlagColumns()`. Never redeclare them per table.
- Titles are keyed by `(kind, tmdb_id)`, and `imdb_id` is optional. Never invent synthetic ids or `0` sentinels (unknown = `NULL`). Source data is read by reference (`title_um` → `um_source`), not copied.
- Migration order matters: `db:seed:movies` before `db:seed:um`.
- **Production deploys migrate first** (`.claude/rules/deploy-standards.md`, Deploys). A migration merged to `main` reaches the production database on the next deploy, so write it to be safe against live data.
- **Every schema change ships its generated migration** (SQL + snapshot + journal from `pnpm db:generate`) in the same change. CI's `migrations` job fails on drift.
  - Never hand-write or hand-edit a snapshot JSON.
  - `db:generate` prompts need a TTY. Without one, run `script -qec "pnpm exec drizzle-kit generate" /dev/null` and answer the prompts.

## Testing

- Unit tests: Vitest, co-located in `__tests__/` subfolders (`src/`, `db/`, `scripts/`). Playwright e2e specs live in top-level `e2e-tests/`.
- **Anything touching the database gets a `*.db.spec.ts`**, run by `pnpm test:db` (the Vitest `db` project, on a local D1 in Miniflare that needs no Docker, secrets or network; every table is emptied before each test). Unit specs must not need a live DB: mock `#lib/server/db`.
- When moving a function to a new file, update its test's import path. Don't leave a test importing from the old location.
- A behaviour change ships with its test in the same change. A test that asserts the buggy result is a finding.

## Making a change

- Keep the behaviour readers see exactly, unless the plan or the user changes it. If a speed-up or a refactor cannot be had without changing one, stop and ask the user. Do not work around it silently.
- Measure a speed-up before and after with a scratch script in the session scratchpad, and report both numbers. The script is not committed.
- A change that makes the site send, store or share anything it did not before (a new request, a new cookie, a new third party, a new kind of stored data) updates `PRIVACY.md` and `SECURITY.md` in the same change.
- Update `docs/architecture.md` whenever you add, move, rename or delete a file, change a module's responsibility, add a shared component, or alter a structural pattern. Update `DESIGN.md` for anything visible. Both follow `.claude/rules/docs-standards.md`.
- Match the surrounding code: comments that say what the code does now, in sentence case, with the same naming.
  - A comment cites a doc by file and section heading (`docs/architecture.md, Caching policy`), never by line number.
  - It does not narrate what the code used to do.
- No `oxlint-disable` or `eslint-disable` without a reason on the same line that says why the rule is wrong there. A promise is awaited or explicitly `void`-ed (`void goto(...)`). Oxlint's type-aware rules (`no-floating-promises`) cover `.ts` and `.js`, `.svelte.ts` rune modules included; a `.svelte` `<script>` gets only Oxlint's syntax rules, so a fire-and-forget there is `void`-ed by hand.
- No `any`, no empty `catch`, no commented-out code, and no unused export left "for later". No new dependency that the live plan or the user did not ask for.
- A script an agent runs prints only what the agent needs to act on. A failure prints its full output.

## Checking a change

Run the cheap checks often and the full set once.

- **While working:** `pnpm check`, `pnpm typecheck` and `pnpm lint` take seconds, so run them after each edit that could break them. Run the tests the edit touches with `pnpm exec vitest run <file>`.
- **Once, at the end, the verification baseline:**
  - `pnpm check` → 0 errors
  - `pnpm typecheck` → 0 errors
  - `pnpm lint` → clean (AGENTS.md, Commands, says what it runs)
  - `pnpm test:unit --run` → all pass
  - `pnpm test:db` → all pass
  - `pnpm build` → clean

  Do not run it again on an unchanged tree: a green run stands until a file changes. Fix a failure with the failing file (`pnpm exec vitest run <file> -t "<name>"`), then run the baseline once more.

- **Reporting:** give each command with its result, and say whether the tree changed after it ran. A command that could not run is reported as not run, with the reason.
