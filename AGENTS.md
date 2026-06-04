# MIDB — Agent Rules

> Actionable rules for working in this codebase. The full reference is in `.CLAUDE/architecture.md` — read it before touching unfamiliar areas.

---

## Always

- **Update `.CLAUDE/architecture.md`** whenever you add, move, rename, or delete a file, change a module's responsibility, add a shared component, or alter a structural pattern. The doc is a living snapshot; keep it current.
- **Run the verification baseline** before reporting a task done: `bun run check` → 0 errors, `bun run test:unit` → all pass, `bun run build` → clean.
- **Use `$lib` and `$db` aliases** for all cross-folder imports. Relative `./` is for same-folder siblings only.

---

## Server / client boundary

- `$lib/server/**` is a hard SvelteKit boundary — nothing client-reachable may import from it. Secrets (`TMDB_API_TOKEN`, `DDD_API_KEY`) and all DB access live here only.
- To expose a server type to a client component, re-export it **as a type** from `$lib/media/types/*`. Type-only imports are erased at build and do not leak runtime server code. See `media/types/ddd.ts` → `integrations/ddd-types.ts` as the pattern.
- `data/` = Postgres/Drizzle modules. `integrations/` = external HTTP clients.

---

## Route folders are thin

- Route folders (`src/routes/*/`) hold only `+page.svelte`, `+page.server.ts`, and a route-specific `datasource.server.ts`.
- Logic shared by two or more routes goes in `$lib/server/` (server) or `$lib/media/` (client-safe). Never put shared logic inside a route folder.

---

## File organisation

- **One concern per file.** When a file mixes identity resolution, algorithm logic, and rendering — split it. Name files after what they do, not what they are adjacent to.
- **Split along these lines for the data layer:**
  - Identity resolution + trivial DB fetches → `server/data/media-queries.ts`
  - Domain-specific query algorithms (e.g. UM disambiguation) → their own file (`um-candidates.ts`)
  - Public domain types with no runtime → `integrations/*-types.ts`, re-exported via `media/types/`
- **Rune modules** (`.svelte.ts`) must be imported with an explicit `.js` extension or Vite resolves the Svelte component instead of the module. Pattern: `import { x } from './foo.svelte.js'`.

---

## Components

- **`ui/` vs domain.** Generic, reusable primitives (button, tile, skeleton, tooltip) go in `$lib/components/ui/*`. Title-specific UI goes in domain folders (`movies/facts/`, `movies/sections/`, `movies/metrics/`, `movies/media/`, `search/`, …).
- **Components own their styles.** A component's CSS classes should not leak into parent pages. If the same visual pattern appears in two pages, extract a component rather than duplicating the stylesheet.
- **`@reference` depth.** `<style lang="postcss">` blocks need `@reference` pointing at `src/app.css`. Count the folder depth: four `../` for components two levels deep under `movies/*` or `ui/*`; three for shallower ones (`layout/`, `search/`). Wrong depth causes silent Tailwind resolution failures in unit tests.
- **No orphan revival.** `ui/tile/processTileGrid`, `movies/metrics/metricsFrame`, `movies/sections/sectionSkeleton`, and `landing/topBar` are orphaned — do not reuse or revive them.

---

## Styling

- Tailwind v4, CSS-first. Source of truth is `src/app.css`.
- Use design tokens (`--brand`, `--surface`, `--ink-muted`, etc.), not raw colours. Status tokens: `--success`, `--warn`, `--danger`, `--info`.
- `<style lang="postcss">` + `@reference "…/app.css"` in every component that uses `@apply` or tokens.

---

## Database

- The DB layer lives in `db/` (outside `src/`), aliased as `$db/*`.
- GET routes use **read-only** resolvers (`getDbMovie`, `getDbMedia`) — page visits must never mutate the DB.
- Write paths (`getOrCreateDbMovie`, `getOrCreateDbMedia`) are reserved for future write endpoints (community ratings, persisted DDD tags).
- Migration order matters: `db:seed:movies` before `db:seed:um`.
- `db:generate` requires a TTY — run it from a real terminal, not CI.

---

## Testing

- Unit tests: Vitest, co-located in `__tests__/` subfolders. Playwright e2e specs in top-level `e2e-tests/`.
- When moving a function to a new file, update its test's import path — don't leave a test importing from the old location.
