# Major-Version Upgrade: MIDB

## Context

MIDB is a revived SvelteKit movie-diversity-rating app. After reviving it (env setup, merge-conflict resolution, DB migrations) and applying safe minor updates, the remaining dependencies are several majors behind. This plan upgrades **everything to its latest major except Storybook (stays 7.x) and TypeScript (stays 5.x)**.

Stack today → target:
- **Svelte 4.2 → 5.x** (runes/snippets) — *full idiomatic rewrite chosen*
- **SvelteKit 2.61 → latest 2.x**, `@sveltejs/vite-plugin-svelte` 3 → 7, `@sveltejs/adapter-auto` 3 → 7
- **Vite 5 → 8**, **Vitest 1 → latest**
- **Tailwind CSS 3.4 → 4.x** (CSS-first config) + `@tailwindcss/postcss`
- **Drizzle ORM 0.29 → 0.45**, **drizzle-kit 0.20 → 0.31**
- **Hanko `@teamhanko/hanko-elements` 0.10 → 2.x**
- **marked 11 → latest** (+ re-seed)
- Supporting: `@faker-js/faker` 8→10, `@loom-io/fs` 0.4→0.6, `@playwright/test` latest, `@testing-library/svelte` 4→5, `@types/jsdom`, `eslint` 8→9 (flat config) + `@typescript-eslint/*` 8 + `eslint-plugin-svelte` 3 + `eslint-config-prettier` 10, `prettier-plugin-svelte` 4, `nodemailer` 6→8, `remixicon` 3→4, `react`/`react-dom` (Storybook-only dev deps — leave on 18 to match Storybook 7), `rxjs` (already latest 7.x).

**Kept back deliberately:** Storybook 7.x (and its `react`/`react-dom`@18 peer, `eslint-plugin-storybook`, `@storybook/addon-svelte-csf`@4) and TypeScript 5.x. NOTE: Storybook 7 + Svelte 5 / Vite 8 is **unsupported** — see Risks. Story files are dev-only and several already have type errors; they are out of scope for runtime correctness.

The decision driver: do the upgrade as **ordered, independently-verifiable phases**, each ending in a working `bun run dev` + `bun run check`, so a regression is isolated to one phase.

---

## Progress log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 — Baseline | ✅ done | pre-existing | `bun run check` baseline: 29 errors (all story/drizzle), dev server loads all routes |
| 1+2 — Vite 8 + Svelte 5 | ✅ done | `d542697`, `4be2e8b` | Merged because vite-plugin-svelte ≥4 requires Svelte 5; full rune/snippet rewrite |
| Storybook 7→9 | ✅ done | `276623b` | Pulled forward from Phase 7; eliminates svelte-preprocess as the source of the nested svelte@4 conflict |
| 3 — Tailwind CSS 4 | ✅ done | — | CSS-first @theme; @tailwindcss/vite plugin; @reference in all 20 component style blocks; TW4 `!` important syntax |
| 4 — Drizzle ORM 0.45 | ✅ done | — | New drizzle.config defineConfig API; fix deep .d imports in seed.ts; array-form index callbacks; drizzle-kit up snapshot upgrade; migration 0005 drops stale Auth.js tables |
| 5 — Hanko 2.x | ✅ done | — | hanko.user.logout() → hanko.logout(); onsessioncreated callback already correct from Phase 2 |
| 6 — marked latest + re-seed | ✅ done | — | await marked.parse() in seed.ts; re-seeded DB |
| 7 — ESLint 9 + remaining deps | ✅ done | — | Flat config eslint.config.js; faker/loom-io/nodemailer/remixicon/prettier bumped; no-unused-vars _ pattern; story files excluded |

**Current state (2026-06-02) — ALL PHASES COMPLETE + post-upgrade fix applied:**
- `bun run check` → **0 errors, 0 warnings**
- `bun run dev` → all routes load
- `bun run build` → clean production build
- `bun run test:unit` → 4/4 pass
- `bunx eslint src/` → 0 errors (story files excluded)
- `bun run storybook` → starts on :6006

**Post-upgrade fix (2026-06-02):** Vite 8 no longer injects `.env` file variables into `process.env` for SSR modules. `db/connections.ts` uses `process.env.DB_CONNECTION` (needed for CLI scripts like `db:seed`/`db:migrate`), which fell through to the default `localhost:5432` in SSR — causing a `password authentication failed` postgres error wrapped in Drizzle's `DrizzleQueryError`. Fixed in `vite.config.ts`: switched to factory-function form of `defineConfig`, added `loadEnv(mode, process.cwd(), '')` (empty prefix = all vars, not just `VITE_`-prefixed), and added a `define` entry to inject `process.env.DB_CONNECTION` at SSR module evaluation time.

**Known workaround still active:** `dedup-svelte` script removes a nested `svelte@4` that bun re-installs on every `bun install`. Source: `svelte2tsx` ← `@storybook/svelte-vite@9` ← `@storybook/sveltekit@9` depends on `svelte-preprocess@5` which pins Svelte 4. Will go away when `svelte2tsx` or `svelte-preprocess` drops the Svelte 4 dep (not in our control).

---

## Phase 0 — Baseline & safety
- Confirm clean working tree; do all work on current branch `feature/movie_page` (or a new `chore/major-upgrades` branch).
- Record current good state: `bun run check` (known 9 story-file errors — that's the baseline), `bun run dev` loads `/`, `/movie/550`, `/movie/550/metric`, `/movie/550/metric/bechdel`, `/auth`.
- Ensure Postgres container `midb-pg` (port 5435) is running.

## ✅ Phase 1+2 — Vite 8 + Svelte 5 (merged, done)
Lowest-coupling infra first, still on Svelte 4.
- `package.json`: bump `vite ^8`, `@sveltejs/vite-plugin-svelte ^7`, `vitest` latest, `@sveltejs/kit` latest 2.x, `@sveltejs/adapter-auto ^7`, `@playwright/test` latest, `@types/jsdom` latest, `jsdom` latest.
- `vite.config.ts`: currently imports `defineConfig` from `vitest/config` and merges SvelteKit plugin + test block. Verify this still type-checks under Vite 8 / Vitest latest; Vitest may now want a separate `vitest.config.ts` or the `test` field typed via `vitest/config` (keep as-is if it compiles).
- `bun install`, then `bun run check` + `bun run dev`. Expect Svelte 4 to still compile under plugin-svelte 7 (it supports both). Fix any Vite-8 config API breaks here.

## ✅ Phase 2 — Svelte 5 + full rune/snippet rewrite (done, merged into Phase 1)
Bump `svelte ^5`, `svelte-check ^4`, `@testing-library/svelte ^5`, `prettier-plugin-svelte ^4`, `eslint-plugin-svelte ^3`.

Run `bunx sv migrate svelte-5` first as an automated pass, then hand-fix. Per-pattern conversions (verified against the Svelte 5 migration guide):

**Props — `export let` → `$props()`** (~20 files, all in `src/lib/components/**` + 3 route `+page.svelte` files). Representative:
- `src/lib/components/form/button.svelte` — props + **`$$restProps`** → `let { type = 'button', name, disabled = false, status = 'primary', ...rest } = $props();` and `<button {...rest}>`.
- `src/routes/movie/[movieId]/+page.svelte`, `.../metric/+page.svelte`, `.../metric/[metricId]/+page.svelte` — `export let data` → `let { data } = $props();`.

**Slots → snippets** (`{@render}` + `children`/named props):
- Default slot files (`button`, `linkButton`, `navigation/item`, `navigation/simple`, `tiles/tileGrid`, `tiles/processTileGrid`, `text/block`, `text/tooltip`, both `+layout.svelte`): `let { children } = $props();` + `{@render children?.()}`.
- Named-slot `icon` with fallback: `tiles/tile.svelte` (`<slot name="icon"><i .../></slot>` → `{@render icon?.() ?? ...}` via an `{#if icon}`/fallback snippet), and its consumers `form/checkboxTile.svelte` (`<slot slot="icon" name="icon">` nested forwarding) and `form/radioTile.svelte`.
- **Slot props**: `frames/metricsFrame.svelte` exposes `<slot detailed={detailed}>` consumed via `let:detailed` in `.../metric/+page.svelte` and `.../metric/[metricId]/+page.svelte`. Convert to a `children` snippet that takes `detailed` as a parameter: child `{@render children?.(detailed)}`, parents use `{#snippet children(detailed)} ... {/snippet}`.

**Component events → callback props:**
- `src/lib/components/search/searchForm.svelte` — remove `createEventDispatcher`; add `let { onaction } = $props()` and call `onaction(query)`. Update consumer `searchForm.stories.svelte` (`on:action` → `onaction={...}`). (Note: `searchForm` is not yet used by any route — low blast radius.)
- Hanko event handled in Phase 5 (`on:onSessionCreated` stays as a web-component DOM event, which is fine).

**Native events `on:` → `on…`:** all `on:click`/`on:change`/`on:input`/`on:submit`/`on:reset` across components → `onclick` etc.

**Unchanged:** `bind:this={processBarGrid}` + `export function reset()` in `processTileGrid.svelte` / `.../metric/[metricId]/+page.svelte` — works identically in Svelte 5 (verified). `onMount` in the Hanko components stays.

**Story files** (`*.stories.svelte`, `<Template let:args>`): Storybook 7's `@storybook/addon-svelte-csf`@4 still uses `let:args`. Leave story files on legacy syntax — Svelte 5 still compiles `let:` in compat mode. Do **not** rewrite stories.

Verify: `bun run check` (component type errors should now be ≤ baseline; story errors may shift), `bun run dev`, click through all routes, exercise the metric checkbox/progress-bar interaction and the "show more/less" toggle.

## Phase 3 — Tailwind CSS 4 ⬜
Bump `tailwindcss ^4`, add `@tailwindcss/postcss`, keep `autoprefixer` only if still needed (TW4 bundles autoprefixing — likely remove).
- `postcss.config.js`: replace `tailwindcss: {}` with `'@tailwindcss/postcss': {}`; drop `autoprefixer`.
- `src/app.css`: replace the three `@tailwind base/components/utilities` directives with a single `@import "tailwindcss";`. Keep the `@layer components` block (`body`, `.bg-component`, `h1`, `h2`) — `@apply` still works in TW4.
- **Migrate `tailwind.config.js` → CSS-first `@theme`** in `app.css`. The custom theme that must port over:
  - **Colors**: 8 groups (`primary, secondary, neutral, gray, danger, success, warn, info`) each with `light/DEFAULT/dark`. In TW4 these become `--color-primary-light`, `--color-primary` (DEFAULT), `--color-primary-dark`, etc. under `@theme`. Pull literal hex values from the current config's `colors.purple[300]`-style references (resolve them to hex, since TW4 `@theme` wants values, though importing the default palette is also possible).
  - **Spacing**: custom scale `xs/sm/md/lg/xl` (+ negatives `-xs…-xl`, `auto`) and `element-*`/`hero` tokens → `--spacing-xs`, `--spacing-sm`, … Negative utilities in TW4 are generated automatically from positive values via the `-` prefix, so define positives only and use `-mx-md` form (already used in `metricsFrame`). Confirm `m-auto`/`gap-*` still resolve.
  - **Screens**: custom `sm/md/lg/xl` breakpoints → `--breakpoint-sm` etc.
  - Tokens consumed by `@apply` across ~20 component `<style>` blocks (e.g. `p-md`, `gap-sm`, `h-element-sm`, `max-w-5xl`, `bg-primary`, `text-neutral`, `border-neutral-light`) must all still resolve — this is the main visual-regression surface.
- `tailwind.config.js`: TW4 can run config-free, but the `content` globs + any plugin hooks can be retained via `@config "./tailwind.config.js";` if needed. Prefer full CSS-first; keep a minimal config only if a feature requires it.

Verify: `bun run dev`, visually compare every route against Phase 0 screenshots — colors, spacing, the movie tile, tile grids, progress bar, buttons (all 6 status variants), collapsible text block. This phase is the highest visual-risk.

## Phase 4 — Drizzle ORM 0.45 + drizzle-kit 0.31 ⬜
Bump `drizzle-orm ^0.45`, `drizzle-kit ^0.31`.
- **`drizzle.config.ts`**: rewrite to new API — `dialect: "postgresql"` (replaces `driver: "pg"`), `dbCredentials: { url: process.env.DB_CONNECTION }` (replaces `connectionString`), keep `out`/`schema`/`breakpoints`. Use `defineConfig` from `drizzle-kit`.
- **`package.json` script**: `db:generate` `drizzle-kit generate:pg` → `drizzle-kit generate` (the `:pg` form is removed).
- **`db/scripts/seed.ts`**: fix fragile deep type imports `drizzle-orm/pg-core/table.d` and `drizzle-orm/pg-core/query-builders/insert.d` (lines 2–3) → import `PgTable` and `PgInsertValue` from the public `drizzle-orm/pg-core`. These deep `.d` paths will not exist in 0.45.
- **`db/connections.ts`**: verify `drizzle(queryClient, { schema })` relational config + `migrate()` signatures unchanged (they're stable across 0.29→0.45). Keep the async `migrateDatabase()` fix already in place.
- **Schema `db/schema/*.ts`**: the `pgTable` third-arg index callback returning an **object** (`(t) => ({ everyUserOnceIdx: uniqueIndex(...) })` in `metric.ts`) — Drizzle 0.36+ prefers returning an **array** `(t) => [uniqueIndex(...)...]`. Update `evaluations` and `evaluationResults` callbacks to array form. Also re-check the PG **indexes API change** flagged in release notes (column-in-index syntax) — the simple `.on(col, …)` usage here is fine but confirm `uniqueIndex('name').on(...)` still compiles.
- **Queries** (`db.query.*.findFirst/findMany`, `.with`, `.prepare`, `sql.placeholder`, `.execute`, `db.insert/update/delete`): API is stable across this range; expect compile-clean. Files: `.../metric/datasource.server.ts`, `.../metric/[metricId]/datastore.server.ts`, `seed.ts`.
- **Migrations**: do NOT regenerate existing migrations. After upgrade, run `bunx drizzle-kit up` only if `bun run db:generate` reports a snapshot-version mismatch; otherwise leave `db/migrations/**` untouched. The DB is already migrated.

Verify: `bun run check`; `bun run db:generate` produces **no** new migration (schema unchanged) — if it tries to, inspect the diff (likely just the index-callback cosmetic change → acceptable, or adjust to avoid churn); re-run `bun run db:migrate` (idempotent); load `/movie/550/metric` and `/movie/550/metric/bechdel` to confirm relational queries return data.

## Phase 5 — Hanko 2.x ⬜
Bump `@teamhanko/hanko-elements ^2`.
- **`src/lib/components/auth/hankoAuth.svelte`**: `register()` + `<hanko-auth>` still valid. Event renamed: `on:onAuthFlowCompleted` → **`on:onSessionCreated`** (web-component DOM event; stays as `on:` even in Svelte 5 since it's a custom element, not a Svelte component event).
- **`src/routes/auth/+page.svelte`**: update the listener on `<HankoAuth>` to forward `onSessionCreated`. Since `HankoAuth` is now a Svelte 5 component (Phase 2), expose the redirect as a **callback prop** (e.g. `onsessioncreated`) rather than `on:` — wire `hankoAuth.svelte`'s inner `<hanko-auth on:onSessionCreated={...}>` to call the prop.
- **`src/lib/components/auth/hankoProfile.svelte`**: `register()` + `<hanko-profile>` — verify element name unchanged in 2.x (it is). Keep `onMount`.
- **`src/lib/components/auth/logoutButton.svelte`**: `new Hanko(url)` constructor still valid, but **`hanko.user.logout()` → `hanko.logout()`** in 2.x. Also fix the post-logout redirect: currently `goto("/login")` but the app has no `/login` route — change to `/auth`.
- **`src/hooks.server.ts`**: `jose` JWKS verification against `${PUBLIC_HANKO_API_URL}/.well-known/jwks.json` and the `hanko` cookie — unchanged in 2.x. No edits expected; confirm the JWKS path is still correct for the 2.x backend.

Verify (needs the real Hanko tenant in `.env`): `/auth` renders the widget, completing login redirects to `/user/dashboard`, the gate in `hooks.server.ts` redirects `/user/*` when logged out, `/user/dashboard` shows the profile, logout returns to `/auth`.

## Phase 6 — marked latest + re-seed ⬜
Bump `marked` to latest.
- **`db/scripts/seed.ts` line 26**: `marked.parse(...)` — in marked 16+ `parse()` can return `string | Promise<string>`. The seed already runs in an `async` context; wrap with `await marked.parse(...)` (or `marked.parse(md, { async: false })` to force sync) so stored HTML is a string, not `[object Promise]`.
- Re-run `bun run db:seed` to re-render the Bechdel description+options HTML with the new marked, overwriting the old stored HTML.

Verify: load `/movie/550/metric/bechdel`; the `{@html description}` in `TextBlock` renders formatted markdown (headings, lists, bold) — visually confirm it matches the prior render and there's no literal `[object Promise]`.

## Phase 7 — Tooling: ESLint 9 flat config + remaining deps ⬜
- **Already done:** Storybook 7→9, `@storybook/addon-svelte-csf` 4→5, `eslint-plugin-storybook` 0.6→0.11, `react`/`react-dom` removed.
- Remaining: Bump `eslint ^9`, `@typescript-eslint/eslint-plugin ^8`, `@typescript-eslint/parser ^8`, `eslint-config-prettier ^10`, `eslint-plugin-svelte ^3`, `prettier` latest, `@faker-js/faker ^10`, `@loom-io/fs ^0.6`, `nodemailer ^8` (unused at runtime — leftover from dropped Auth.js; consider removing entirely), `remixicon ^4` (icon-class renames possible — audit `ri-*` classes used: `ri-arrow-left-line`, `ri-search-line`, `ri-arrow-down-s-line`, `ri-arrow-up-s-line`).
- **ESLint 9 requires flat config**: migrate `.eslintrc.cjs` → `eslint.config.js` (flat). `eslint-plugin-svelte ^3` and `typescript-eslint ^8` both ship flat presets. This is a config rewrite, not source changes. `eslint-plugin-storybook` lags — pin/guard so it doesn't block lint; if incompatible with ESLint 9, scope it out (stories are dev-only).
- Keep `@loom-io/fs` only if seed still needs it; it's the only consumer.

Verify: `bun run lint` (or accept story-plugin gaps), `bun run format`, final full `bun run check` + `bun run dev` clickthrough.

---

## Risks & mitigations
- **Storybook 7 vs Svelte 5 / Vite 8 = unsupported.** Storybook 7 predates both. `bun run storybook` / `build-storybook` will likely break. Mitigation: this plan keeps app + tests green; Storybook is dev-only. If `storybook dev` breaks, that's expected and out of scope (a later Storybook 7→8/9 upgrade is the fix). Call this out to the user before starting — if Storybook must keep working, Svelte 5 has to wait.
- **Tailwind 4 visual regressions** (Phase 3) are the most likely user-visible breakage; the custom color/spacing token port is where to focus review. Take before/after screenshots of every route.
- **marked async `parse()`** silently storing a Promise → guard with `await`/`{async:false}` and verify rendered HTML, not just that seed exits 0.
- **Drizzle index-callback** object→array change may cause `db:generate` to want a no-op migration; inspect before applying, avoid churning `db/migrations/**`.
- **`react`/`react-dom`** stay at 18 (Storybook 7 peer); do not bump to 19.

## Verification matrix (run after each phase, full pass at end)
1. `bun install` clean
2. `bun run check` — component/route code error-free (story-file errors tracked against Phase 0 baseline)
3. `bun run dev` loads without console errors
4. Routes: `/`, `/movie/550`, `/movie/550/metric`, `/movie/550/metric/bechdel` (DB + marked + relational query), `/auth` (Hanko), `/user/dashboard` (auth gate + profile), logout → `/auth`
5. Interactions: metric checkbox sequential select + progress bar, "show more/less" toggle, all 6 button variants render
6. `bun run db:generate` produces no unintended migration; `bun run db:migrate` + `bun run db:seed` succeed
7. Visual diff vs Phase 0 screenshots (Tailwind)

## Out of scope
- Storybook 7→8/9 and `react`@19 (intentionally held).
- TypeScript 6 (intentionally held at 5.x).
- The known-broken `*.stories.svelte` type/prop mismatches (pre-existing, dev-only).
- Feature gaps noted earlier (empty home search, evaluation form not persisting) — separate work.
