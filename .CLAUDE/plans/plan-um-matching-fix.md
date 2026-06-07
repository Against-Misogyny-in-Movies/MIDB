# Fix UM (Unconsenting Media) matching + user-confirmed disambiguation

## Context

On the movie detail page, Bechdel and DDD data render but **UM data almost always shows "No data"** even when UM's website has it. Example: searching "wuthering heights" → selecting **Wuthering Heights (2026)** → `/movie/1316092` shows DDD + Bechdel but **no UM**, despite UM having a row for it.

I traced this end-to-end against the live DB. UM is the only source with **no `imdb_id`**, so it is matched purely on a normalized title key (`movies.clean_title`). That matching is broken in two independent ways, plus there's a structural gap:

- **Bug A — year baked into UM's clean name, not the spine's.** UM's `cleanName`/`cleanNameArticles` for many titles include the year (`"wuthering heights 2026"`), while the spine's `clean_title` is year-less (`"wuthering heights"`, from the Bechdel CSV where the year is a separate column). So **none** of the seeder's candidates match. Measured: **1,251 of 10,496 UM movie rows (~12%)** have a year-suffixed clean name and are systematically unmatchable today.
- **Bug B — `getOrCreateDbMovie` doesn't normalize.** `db.server.ts:46` sets `cleanTitle: movie.title.toLowerCase().trim()` instead of `normalizeTitle(...)`. TMDB returned the 2026 title wrapped in quotes, so the DB row's key is `"\"wuthering heights\""` (literal quote chars) — confirmed the only 3 non-normalized `clean_title`s in the DB are exactly the rows this function created. Such a key can never match anything.
- **Structural gap — collisions + spine-absent movies.** The Bechdel CSV has Wuthering Heights **1939** and **2011** only; the **2026** remake isn't in the spine, so its movie row was born at visit time with no metric data, and the seeder never reattaches UM. Separately, **226 `clean_title`s collide across 477 movies** (same title, different year) — the year-blind seeder risks binding UM to the *wrong* same-titled film.

**Goal:** make UM match reliably by title **and year**, fix the normalization bug, and — per the user's decision — when a movie has no confident UM match but UM has a plausible candidate for that title, **let the user confirm the correct match on the detail page**, persisting their choice so it survives re-seeding.

## Approach

### 1. Fix Bug B (normalization) — `src/routes/movie/[movieId]/db.server.ts`
- Import `normalizeTitle` from `$db/scripts/lib/normalizeTitle` (server-only code, fine in `*.server.ts`).
- Change the insert at `db.server.ts:46` to `cleanTitle: normalizeTitle(movie.title)`.
- The 3 existing junky rows self-correct on re-seed / re-derivation; no migration needed — it's a value fix.

### 2. Year-aware UM matching at seed time — `db/scripts/seedUnconsenting.ts` (+ `normalizeTitle.ts`)
- Add an exported `stripTrailingYear(s: string)` helper to `db/scripts/lib/normalizeTitle.ts` that removes a trailing ` (19|20)\d\d` from an already-normalized string and returns `{ key, year }`. Cover it in `src/lib/normalizeTitle.spec.ts`.
- In `seedUnconsenting.ts`:
  - Build the title index as **`Map<cleanTitle, Array<{id, year}>>`** (today it's `Map<cleanTitle,id>` and silently keeps only the last of any colliding title — a latent bug).
  - For each UM row, derive `(titleKey, umYear)` by stripping the trailing year from the normalized candidate, falling back to the `yearOfRelease` column.
  - **Match policy:**
    1. Exact `(titleKey, umYear)` → bind.
    2. Else if the title key maps to exactly **one** movie → bind (unambiguous).
    3. Else (ambiguous: multiple same-title movies, no exact-year hit) → **do not guess.** Leave unmatched and write to the report with reason `ambiguous` + the candidate movie years, so it's resolvable via runtime user confirmation.
  - Keep idempotent upsert; respect user-confirmed links (don't overwrite a `user-confirmed` row).

### 3. Schema: record how a UM link was established — `db/schema/movie.ts` (+ migration)
- Add to `movieUnconsenting`: `matchSource varchar` default `'seed-auto'` (`'seed-auto' | 'user-confirmed'`). Lets the seeder skip user-confirmed rows; auditable.
- Generate a migration with `bun run db:generate`. **Blocker to handle first:** drizzle-kit globs `db/schema/**/*.ts` including the orphaned `metric.ts`, which would try to recreate dropped tables (architecture.md Known gap #1). **Delete `db/schema/metric.ts` before generating** (already dead — not imported by `connections.ts`). Then `bun run db:migrate`.

### 4. Runtime UM candidate lookup + user confirmation

**Server lookup — `src/routes/movie/[movieId]/db.server.ts`:**
- New `getUnconsentingCandidates(movie)`: when `getUnconsenting(dbMovie.id)` returns null, query `um_source` (§5) for rows whose year-stripped `clean_title_key` matches the movie's normalized title. Return a slim `{ umId, cleanName, year, flagCount }[]`; cap to a few; only surface when ≥1.

**Load — `src/routes/movie/[movieId]/+page.server.ts`:**
- After `getUnconsenting`, if null, also fetch `umCandidates` and return them (fast DB call, stays in SSR).

**Confirm action — `src/routes/movie/[movieId]/+page.server.ts` `actions`:**
- Add a SvelteKit `actions.confirmUm` (first form action in the repo; `/api/search/+server.ts` is the only nearby server endpoint, GET-only — introduces the `enhance` pattern). Takes `umId` + the resolved `dbMovie.id`, reads that entry's flags/comment from **`um_source`** (§5), and **upserts** `movie_unconsenting` for this `movie_id` with `matchSource: 'user-confirmed'`.

**UI — `src/routes/movie/[movieId]/+page.svelte` + a new `umCandidates.svelte` (`#unconsenting` section):**

Two coordinated parts: a **badge on the UM chip** (header) signalling "there are candidates to pick", and the **candidate picker** inside the `#unconsenting` body, styled like the landing-page search results.

*Badge on the UM chip (unintrusive but noticeable).* The chip (`+page.svelte:62`) is already `position: relative` + `overflow-hidden`. Shown only when `unconsenting === null && umCandidates?.length`:
- **Exclamation dot:** a ~16px circular badge inset in the chip's top-right (`absolute top-1 right-1`, inside so we keep `overflow-hidden` + the gradient clip), containing `ri-error-warning-line` in `--info` (informational — `--warn` is reserved for actual present concerns, so `--info` avoids implying a content warning).
- **Constant pulse** (per user): a continuous gentle pulse — a soft expanding `--info` ring via `::after` keyframes on `animation: … infinite`, kept subtle (low opacity, ~2s ease cycle) so it reads as "heads up" not "error". **Gated behind `prefers-reduced-motion`** → static dot fallback (repo motion convention in `searchResult.svelte`/`dddTags`).
- a11y: `aria-label="{n} possible Unconsenting Media matches — choose below"` on a visually-hidden span / the chip; badge `aria-hidden`. The chip's `href="#unconsenting"` already scrolls to the picker.

*Candidate picker (search-result look).* New presentational component `src/lib/components/movies/umCandidates.svelte`, rendered in the `#unconsenting` body when `unconsenting === null && umCandidates?.length`:
- Intro line: "We found {n} possible Unconsenting Media match(es) for this title — which one is this film?"
- A `role="list"` of rows mirroring `search/searchResult.svelte`'s layout (title + a year meta line with `ri-film-line` + a trailing affordance) and styling idioms (`@reference app.css`, `gap-sm p-xs rounded-sm`, `text-ink-muted` meta, hover → `bg-accent-bg`). **Deliberate divergence:** UM candidates have **no poster** (the `um_source` catalog has no TMDB path), so replace `resultPoster` with the UM glyph (`ri-shield-cross-line` in a small tinted circle, echoing `.chip-icon`) and show a **flag-count pill** (`{flagCount} concern(s)`) as the secondary signal.
- Each row is a `<form method="POST" action="?/confirmUm" use:enhance>` with a hidden `umId`; the whole row (or a trailing "This one" button) submits. `enhance` default re-runs `load`, so the section re-renders with the now-bound UM data — no manual state.
- Keep the existing "not in the Unconsenting Media database" copy only when there are **no** candidates.

This keeps the chip honest (still shows "No data", since nothing is confirmed yet) while the badge + picker invite resolution; reuse the search-result CSS patterns rather than inventing new ones.

### 5. `um_source` catalog table (enables runtime confirm) — `seedUnconsenting.ts` + schema

**Why a new table when `movie_unconsenting` exists:** the two answer different questions. `movie_unconsenting` is a *binding* — PK `movie_id`, FK to `movies` — so it can only hold UM entries that **already matched** a spine movie. By construction it **cannot** represent the cases we're fixing: the ~12% year-suffixed rows and ambiguous collisions have no confident `movie_id`, and spine-absent films (Wuthering Heights 2026) have no `movies` row to hang a record on. Their flags exist **only in the CSV at seed time** today, so nothing in the DB can serve a runtime "is this the right film?" prompt.

`um_source` is the spine-independent **catalog** — every movie-type UM entry keyed by `um_id` (the 9 flags + `comment` + normalized `clean_title_key` + `year`) — mirroring what UM publishes. `movie_unconsenting` becomes the **resolved projection**: this `um_id` is confirmed to be this `movie_id`, via `seed-auto` or `user-confirmed`. This (a) gives the candidate lookup + confirm action a durable source for flags, (b) survives restarts and is shared across instances (unlike an in-memory index) and avoids reparsing ~55k CSV rows per request (unlike re-reading the CSV), and (c) turns matching from a one-shot lossy seed-time guess into a durable relation we can re-run/improve and let users correct — while `match_source = user-confirmed` rows survive re-seeds untouched.

- Schema: `umSource` table (`umId` PK, `cleanName`, `cleanTitleKey`, `year`, all 9 boolean flags, `comment`).
- `seedUnconsenting.ts` populates `um_source` for **all** movie-type rows (idempotent), then resolves bindings into `movie_unconsenting` per §2's policy.

## Critical files
- `src/routes/movie/[movieId]/db.server.ts` — Bug B fix; `getUnconsentingCandidates`; confirm upsert.
- `db/scripts/seedUnconsenting.ts` — year-aware match; populate `um_source`; respect `user-confirmed`.
- `db/scripts/lib/normalizeTitle.ts` + `src/lib/normalizeTitle.spec.ts` — `stripTrailingYear` helper + tests.
- `db/schema/movie.ts` — `matchSource` column + new `umSource` table; **delete `db/schema/metric.ts`** before generating migration.
- `src/routes/movie/[movieId]/+page.server.ts` — fetch candidates; `actions.confirmUm`.
- `src/routes/movie/[movieId]/+page.svelte` — UM-chip badge (when candidates exist) + render the picker in `#unconsenting`.
- `src/lib/components/movies/umCandidates.svelte` — **new** picker component (search-result layout, no poster, per-row confirm form). Reuses CSS idioms from `src/lib/components/search/searchResult.svelte`.

## Verification
1. `bun run db:generate` (after deleting `metric.ts`) → review SQL → `bun run db:migrate`.
2. `bun run db:seed:movies` then `bun run db:seed:um`; confirm console match count rises substantially vs. the prior ~2,644 bound rows, and the unmatched report now distinguishes `ambiguous` from `no_match`.
3. DB spot-check (bun script over `$db/connections`): Wuthering Heights **1939/2011/2026** rows + their UM linkage; confirm year-suffixed UM rows bind to the right year, and the 2026 row's `clean_title` is `"wuthering heights"` (Bug B fixed) on next visit.
4. `bun run dev`, visit `/movie/1316092` (Wuthering Heights 2026 — a genuine ambiguous/year case): the UM chip shows the **exclamation-dot badge** (subtle `--info`, constant gentle pulse), and `#unconsenting` shows the **candidate picker** styled like the landing search results (title + year + flag-count pill, no poster). Click a candidate → `enhance` re-runs `load` → section re-renders with the UM flags and the badge disappears; reload → still bound (`matchSource = user-confirmed`); re-run `db:seed:um` → the confirmed link is **not** overwritten. Sanity-check the unambiguous path on a single-title film (no badge, direct render). Verify the badge respects `prefers-reduced-motion` (no pulse).
5. `bun run test:unit` for the `normalizeTitle`/`stripTrailingYear` spec. (Repo-wide `lint`/Prettier is known-dirty — scope checks to changed files; Playwright browser is missing per memory, so rely on unit + manual browser review.)

## Rollout
After the code changes: delete `metric.ts` → `bun run db:generate` → review SQL → `bun run db:migrate` → re-run `bun run db:seed:movies` + `bun run db:seed:um`. Idempotent upserts make the full re-seed safe and rebuild bindings correctly from scratch (also re-normalizes any spine `clean_title` already persisted).
