# MIDB — Agent Rules

> Actionable rules for working in this codebase. The full reference is in `.CLAUDE/architecture.md` — read it before touching unfamiliar areas.

---

## Always

- **Update `.CLAUDE/architecture.md`** whenever you add, move, rename, or delete a file, change a module's responsibility, add a shared component, or alter a structural pattern. The doc is a living snapshot; keep it current.
- **Save every plan under `.CLAUDE/plans/`** as a markdown file (e.g. `.CLAUDE/plans/plan-<short-name>.md`). Implementation plans, design notes, and multi-step proposals all belong there — not scattered elsewhere or left only in chat.
- **Run the verification baseline** before reporting a task done: `bun run check` → 0 errors, `bun run lint` → clean, `bun run test:unit` → all pass, `bun run test:db` → all pass (with `docker compose up -d db`), `bun run build` → clean.
- **Use `$lib` and `$db` aliases** for all cross-folder imports. Relative `./` is for same-folder siblings only.

---

## Server / client boundary

- `$lib/server/**` is a hard SvelteKit boundary — nothing client-reachable may import from it. Secrets (`TMDB_API_TOKEN`, `DDD_API_KEY`) and all DB access live here only.
- To expose a server type to a client component, re-export it **as a type** from `$lib/media/types/*`. Type-only imports are erased at build and do not leak runtime server code. See `media/types/ddd.ts` → `integrations/ddd-types.ts` as the pattern.
- `data/` = Postgres/Drizzle modules. `integrations/` = external HTTP clients.
- **Never return a `UserRow` from a load; pages using `PUBLIC_PAGE` must not depend on the request's user.** The client gets `PublicUser` (`toPublicUser`) only, via `/api/me` or the `/user` layout; the email reaches the client on `/user/profile` alone. Public pages (`PUBLIC_PAGE` from `$lib/server/http/cache.ts`) are CDN-cached with a cookie-blind key, so their loads never call `locals.getUser()` or read `locals.claims`. The navbar reads the client session (`session.svelte.js`).
- **Authorize with the guards.** Every load, action and endpoint that needs a user calls `requireUser` / `requireRole` from `$lib/server/auth/guards.ts` (redirect for pages, 401/403 otherwise). The hook's `/user` gate is claims-only and does not cover form actions on public pages.

---

## Route folders are thin

- Route folders (`src/routes/*/`) hold only `+page.svelte`, `+page.server.ts`, and a route-specific `datasource.server.ts`.
- Logic shared by two or more routes goes in `$lib/server/` (server) or `$lib/media/` (client-safe). Never put shared logic inside a route folder.

---

## File organisation

- **One concern per file.** When a file mixes identity resolution, algorithm logic, and rendering — split it. Name files after what they do, not what they are adjacent to.
- **Split along these lines for the data layer:**
  - Identity resolution → `server/data/title-queries.ts`; trivial seeded-metric fetches → `server/data/sources.ts`
  - Domain-specific query algorithms (e.g. UM disambiguation) → their own file (`um-candidates.ts`)
  - Public domain types with no runtime → `integrations/*-types.ts`, re-exported via `media/types/`
- **Rune modules** (`.svelte.ts`) must be imported with an explicit `.js` extension or Vite resolves the Svelte component instead of the module. Pattern: `import { x } from './foo.svelte.js'`.

---

## Components

- **`ui/` vs domain.** Generic, reusable primitives (button, tile, skeleton, tooltip) go in `$lib/components/ui/*`. Title-specific UI goes in domain folders (`movies/facts/`, `movies/sections/`, `movies/metrics/`, `movies/media/`, `search/`, …).
- **Components own their styles.** A component's CSS classes should not leak into parent pages. If the same visual pattern appears in two pages, extract a component rather than duplicating the stylesheet.
- **`@reference` depth.** `<style lang="postcss">` blocks need `@reference` pointing at `src/app.css`. Count the folder depth: four `../` for components two levels deep under `movies/*` or `ui/*`; three for shallower ones (`layout/`, `search/`). Wrong depth causes silent Tailwind resolution failures in unit tests.
- **No orphan revival.** `ui/tile/processTileGrid`, `movies/metrics/metricsFrame`, `movies/sections/sectionSkeleton`, and `landing/topBar` are orphaned — do not reuse or revive them.
- **Performance & smooth UX are a priority, especially above the fold.** Never block first paint on client-streamed data (e.g. DDD via `dddStream.svelte.js`): render a provisional/`pending` state immediately and update in place. Reserve layout so streamed/async updates cause **zero layout shift** — fixed-height cards, one-line clamped summaries (`line-clamp-1`), no reflow of siblings. Derive view state with `$derived` over already-loaded data (cheap, recomputes only on real input change); avoid effects, DOM measurement, and extra requests for first-render UI. Ease state changes with the shared `0.15s ease` transition and gate every animation on `prefers-reduced-motion` (see `metricChip.svelte`). Use `aria-busy` for in-progress streaming states instead of spinners that shift layout.

---

## Styling

- Tailwind v4, CSS-first. Source of truth is `src/app.css`.
- Use design tokens (`--brand`, `--surface`, `--ink-muted`, etc.), not raw colours. Status tokens: `--success`, `--warn`, `--danger`, `--info`.
- `<style lang="postcss">` + `@reference "…/app.css"` in every component that uses `@apply` or tokens.
- **New components must match the existing visual language — reuse the established vocabulary, don't invent values.** Surfaces are `rounded-md border border-border bg-surface-raised`; hovers tint with `color-mix(in oklab, var(--brand) 35%, var(--border))`; tinted status fills use `color-mix(in oklab, var(--token) 16%, transparent)` with the solid token for text (see `collapsibleSection.svelte` `.status--*`); "no data"/neutral states use `--secondary-soft` bg + `--ink-muted` fg. Titles use the `.display` font; spacing/sizing use the `xs/sm/md/lg/xl` tokens. Before adding a card/pill/chip, copy the pattern from `collapsibleSection.svelte` or `metricChip.svelte` rather than picking new percentages or radii.
- **Metric status rows share one marker language.** Per-item status lists (Bechdel criteria ladder, UM flags) use a `1.375rem` round marker holding a glyph or step number, rows `flex items-center gap-sm text-sm` with `padding-block: var(--spacing-xs)`. Active states fill `color-mix(--token 16%, transparent)` + solid-token glyph; inactive states stay quiet (`--secondary-soft`/`--ink-muted`, or a transparent marker with a `--border` hairline). **Pick the token semantically:** brand for neutral progress (Bechdel — pass/fail already lives in the section status pill, so no green/red banner), `--warn`/`--success` only where a per-item value is a real signal (UM concerns / `noRape` reassurance). When adding a new metric checklist, copy this marker — see the `.criterion-*` block in `movie/[movieId]/+page.svelte` and `.flag-*` in `umMetricSection.svelte`, and the _Shared marker pattern_ section in `.CLAUDE/architecture.md`.
- **Data legibility beats colour-coding.** In dense tables (cast/crew representation), keep numeric values in high-contrast `--ink`/`--ink-muted` and carry colour identity in bars + swatches — never colour the digits themselves (bright tokens like `--accent-bg` as text fail contrast). Give same-as-track segments (`unknown` on `--border`) an inset edge so they stay visible.

---

## Copy & voice

Applies to all **user-facing** text (page copy, taglines, labels, notes) — not code comments, `<title>` tags, or commits. The `/resources` page is the reference voice; full rationale in `.CLAUDE/architecture.md` → _Copy & voice_.

- **Matter-of-fact, not salesy.** State what a thing is and what happens. No marketing tone, rhetorical questions, reader flattery, or hedging filler ("just", "the gist", "roughly").
- **Third person everywhere except the landing page (`/`).** Don't address the reader as "you" (use "the page", "a reader"); the landing page is the sole second-person exception. The site's own "we"/"our"/"MIDB" voice is fine.
- **No em dashes (—) in copy.** Split sentences or use a colon. En dashes (–) stay in ranges (`0–3`, `adult–teen`).
- **Claims must be code-backed.** Computation details, thresholds, and privacy claims must match the code (e.g. the verdict explainer mirrors `verdict.ts`). Update copy when the code changes.

---

## Database

- The DB layer lives in `db/` (outside `src/`), aliased as `$db/*`.
- **App code gets `db` from `$lib/server/db` only.** It connects lazily from `DB_CONNECTION` in `$env/dynamic/private` and throws if unset. Never read the connection string at build time (no Vite `define`, no `$env/static/private`) and never add a localhost fallback. Scripts use `db/scripts/lib/db.ts` and close the pool when done.
- GET routes use the **read-only** resolver `getTitleRow(kind, ref)` — page visits must never mutate the DB.
- The write path `getOrCreateTitleRow(kind, ref)` is reserved for future write endpoints (community ratings, comments).
- Titles are keyed by `(kind, tmdb_id)`, `imdb_id` is optional; never invent synthetic ids or `0` sentinels (unknown = `NULL`). Source data is read by reference (`title_um` → `um_source`), not copied.
- Migration order matters: `db:seed:movies` before `db:seed:um`.
- **Every schema change ships its generated migration** (SQL + snapshot + journal from `bun run db:generate`) in the same PR; CI's `migrations` job fails on drift. Never hand-write or hand-edit a snapshot JSON. `db:generate` prompts need a TTY; without one, run `script -qec "bunx drizzle-kit generate" /dev/null` and answer the prompts.

---

## Testing

- Unit tests: Vitest, co-located in `__tests__/` subfolders. Playwright e2e specs in top-level `e2e-tests/`.
- **Anything touching Postgres gets a `*.db.spec.ts`**, run by `bun run test:db` (Vitest `db` project, real Postgres at `TEST_DB_CONNECTION`, tables truncated before each test). `bun run test:db` joins the verification baseline (with `docker compose up -d db`). Unit specs must not need a live DB: mock `$lib/server/db`.
- When moving a function to a new file, update its test's import path — don't leave a test importing from the old location.
