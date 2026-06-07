# MIDB — Light/Dark Theme System + Editorial Landing Page

## Context

MIDB is a movie database that tells people whether a film contains misogynistic content or
depictions of violence against women. Data is sourced partly from users and partly from partner
organizations (TMDB is already wired for movie metadata). It is a non-profit reference, not a
sales product.

Today the root route (`src/routes/+page.svelte`) is still the default "Welcome to SvelteKit"
boilerplate, and the app has **no theme switching** — `app.css` ships a single light palette. This
change delivers two things together:

1. A **light/dark theme system** stemming from the user's violet→aqua palette, defaulting to the
   OS preference, overridable by a persisted manual toggle, with **no flash** of the wrong theme.
2. A **landing page** with an **editorial/serious** identity (deep royal_violet anchor, a single
   aqua accent), minimalistic and deliberately *not* AI-generic, leading with **movie search** as
   the primary CTA and a quiet **"contribute a rating"** secondary action.

### Locked decisions (from the user)
- **Theme behavior:** system default (`prefers-color-scheme`) + manual toggle that overrides +
  persisted in `localStorage` + no-flash init.
- **Primary CTA:** search box is the hero action; secondary line invites contributing/sign-up.
- **Visual identity:** editorial/serious — deep royal_violet brand, exactly **one** aqua accent
  (search submit + data marks), big confident headline, small-caps labels, left-aligned asymmetric
  layout, generous whitespace, high contrast (WCAG AA min, AAA where feasible).
- **Display font:** Fraunces (variable serif, headlines/wordmark only; body stays system sans).
- **Scope:** build the theme system **and** the landing page, with tests.

### Tech ground truth (verified)
- Svelte 5 (runes), SvelteKit 2.21, Tailwind **v4** via `@tailwindcss/vite`, configured entirely in
  `src/app.css` (`@import "tailwindcss"` + `@theme {}` + `@layer components`). `tailwind.config.js`
  is **orphaned** (v4 ignores it by default) — do not rely on it.
- Component style convention: `<style lang="postcss">` + `@reference "<rel>/app.css";` + `@apply`.
- RemixIcon 4.9.1 available; `nanoid` available. Tests: Vitest + `@testing-library/svelte` (jsdom,
  `globals: true`, `*.spec.ts` colocated) and Playwright (`testDir: 'tests'`, builds+previews on
  4173). Scripts: `bun run test:unit` (vitest), `bun run test:integration` (playwright),
  `bun run check` (svelte-check).
- `src/lib/components/search/searchForm.svelte` is real and reusable (`{ method, action, onaction }`,
  placeholder `"Search..."`). **Caveat:** it fires `onaction` on `oninput`/`onchange` *and* submit.
- `src/lib/components/search/movieSearch.svelte` is a **0-byte empty file** — not reusable.
- `tests/test.ts` asserts the boilerplate "Welcome to SvelteKit" h1 — it **will break** and must be
  edited in this change.

---

## Implementation

### 1. `src/app.css` — theme token architecture

**Critical Tailwind v4 detail:** tokens in a normal `@theme {}` block are emitted statically, so
`var()` indirection can be optimized away and will **not** re-cascade on theme change. The semantic,
swappable tokens must go in a **`@theme inline {}`** block — `inline` copies the `var()` reference
into each utility, so reassigning the underlying var under a dark selector updates every utility
live. Verify this in-browser early (highest-risk item).

Keep the existing `@theme` block (spacing, breakpoints) **and the legacy color ramps** intact —
`button.svelte`, `searchForm.svelte`, and `navigation/*` depend on `bg-primary`, `bg-gray-light`,
`border-neutral-light`, `text-white`. Those stay non-theme-aware this pass (migrate later).

Add, in this cascade order:

1. `:root { … }` — raw palette ramps as plain custom props (royal_violet `--rv-*`, aqua accent
   `--aq-*`, derived editorial ink/paper) **and** the **light** semantic defaults.
2. `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }` — **system** dark values.
   Scoping to `:not([data-theme])` is what lets a manual override beat system preference.
3. `:root[data-theme="light"] { … }` and `:root[data-theme="dark"] { … }` — manual overrides.
4. `@theme inline { --color-surface: var(--surface); … }` — expose semantic tokens to Tailwind.

Semantic tokens: `--color-surface`, `--color-surface-raised`, `--color-ink`, `--color-ink-muted`,
`--color-brand`, `--color-brand-strong`, `--color-accent`, `--color-accent-bg`, `--color-accent-ink`,
`--color-border`.

Concrete mappings (high contrast):

| token | light | dark | notes |
|---|---|---|---|
| surface | `#fbf9fd` (violet-warm white) | `#120819` (violet-black) | |
| surface-raised | `#ffffff` | `#1e1029` | |
| ink | `#1a0b24` | `#f3ecf8` | ~16:1 on surface (AAA) |
| ink-muted | `#4a3a57` | `#b9a9c8` | ~8:1 (AAA) |
| brand | `#7400b8` (rv-500) | `#c890ee` (rv-800) | dark needs lightened violet for AA+ |
| accent | `#008a64` (aqua, dark enough for AA UI text) | `#72efdd` | labels/marks only |
| accent-bg | `#64dfdf` | `#72efdd` | search submit fill |
| accent-ink | `#170025` | `#170025` | ink on aqua ≈ 11:1 (AAA) |
| border | `#e3dceb` | `#34234a` | hairline |

Also: `--font-display: "Fraunces", ui-serif, Georgia, serif;` in `@theme`; switch `body` to
`@apply bg-surface text-ink;` + `color-scheme: light dark;`; add `.label` (small-caps:
`text-xs tracking-widest uppercase text-ink-muted; font-variant-caps: all-small-caps`) and
`.display { font-family: var(--font-display); }` in `@layer components`.

### 2. `src/app.html` — no-flash init + display font

In `<head>`, **before** `%sveltekit.head%`, add a synchronous inline script that reads
`localStorage.getItem('theme')` and sets `document.documentElement.dataset.theme` only when it is
`'light'`/`'dark'`; if absent, leave it unset so the `@media` rule drives (the no-flash path for
"system"). Wrap in `try/catch`.

Also add Fraunces minimally (headlines only; body stays system stack):
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" rel="stylesheet">
```

### 3. `src/lib/components/theme/themeToggle.svelte` (new)

**3-state** toggle (system → light → dark → system), justified because the user chose
"system default + manual override" — a 2-state toggle can't return to "follow system." Storage holds
`'light'|'dark'` for overrides and **removes** the key for system.

Svelte 5 runes: `mode = $state<Mode>('system')`, read storage + `matchMedia` in `onMount`,
`resolved = $derived` for which icon to show. Writes happen **only** in the user-driven `cycle()`
(no `$effect` write-loop). `apply(mode)`: for `'system'` `delete dataset.theme` + `removeItem`,
else set both. RemixIcon: `ri-contrast-2-line` (system) / `ri-sun-line` (light) / `ri-moon-line`
(dark). Accessible native `<button>` with `aria-label`/`title` reflecting current mode and a
`data-mode` test hook (omit `aria-pressed` — it's a 3-state cycle, not binary). `focus-visible`
outline in `--accent`. Style via `@reference "../../../app.css"` using `bg-surface-raised`,
`text-ink`, `border-border`, `hover:text-brand`.

### 4. Landing components (new) + replace root page

- **`src/lib/components/landing/topBar.svelte`** — `flex items-center justify-between`. Left:
  `<a href="/" class="display">MIDB</a>` in `text-brand`. Right: `ThemeToggle` +
  `<a href="/auth" data-testid="signin-link">Sign in</a>` (`text-ink-muted hover:text-brand`).
- **`src/lib/components/landing/heroSearch.svelte`** — wraps `searchForm` so we don't mutate the
  shared component. Supplies `action="/search"`, `method="get"`, and an `onaction` that routes via
  `goto('/search?q=' + encodeURIComponent(q))`. **Guard to submit-only:** `searchForm` fires
  `onaction` on every keystroke; track the last value and only navigate when the value is committed
  (or add a tiny `submitOnly` path) so typing doesn't spam navigations. Recolor the submit button to
  the single aqua accent within this scope only:
  `.wrap :global(form button[type="submit"]) { @apply bg-accent-bg text-accent-ink border-accent-bg; }`
- **`src/routes/+page.svelte`** — replace boilerplate. Editorial, **left-aligned/asymmetric**
  (`max-w-2xl`, not centered), generous vertical rhythm (`mt-xl`/`mb-xl`):
  - `<TopBar />`
  - Hero: `<p class="label">A film safety reference</p>`, `<h1 class="display" data-testid="hero-headline">Know before you watch.</h1>`, a one-sentence subhead naming the subject plainly, `<HeroSearch />`, then
    `Seen something we missed? <a href="/auth" data-testid="contribute-link">Add a rating →</a>`.
  - "What we measure" band referencing **real** facts: the **Bechdel Test** (seeded metric),
    **hybrid data** (people + partner orgs + TMDB metadata), **transparent marks**. Brand-colored
    `h3.display`, muted body. `grid` → `grid-cols-3` at `md`.
  - Minimal footer: `MIDB` wordmark + small-caps "Movie Information Database".
  - Copy stays serious and non-sensational.

> **Out of scope (flag only):** `src/routes/search/` results route (TMDB `/search/movie?query=`).
> The hero form's `action="/search"` GET-navigates there even without JS; building the results page
> is a follow-up and the landing/tests below do not depend on it.

### 5. Tests

- **`src/lib/components/theme/themeToggle.spec.ts`** (Vitest, colocated): stub `matchMedia` in
  `beforeEach`, clear `localStorage` + `dataset.theme`. Assert: (a) default mount → `data-mode="system"`,
  no storage key; (b) three clicks cycle `light → dark → system`, each setting/clearing
  `documentElement.dataset.theme` and `localStorage('theme')` correctly; (c) a pre-set
  `localStorage('theme','dark')` is respected on mount. Use `findByRole('button')` (state set in
  `onMount`).
- **`tests/landing.spec.ts`** (Playwright, new): (a) `getByTestId('hero-headline')` visible +
  `getByPlaceholder('Search...')` visible and focusable; (b) `contribute-link` has `href="/auth"`;
  (c) default `html` has no `data-theme`; clicking the toggle (`getByRole('button', { name: /Theme/i })`)
  sets `data-theme="light"` then `"dark"`, and after `page.reload()` it is still `"dark"` (exercises
  the real no-flash init script under preview).
- **Edit `tests/test.ts`**: remove the obsolete "Welcome to SvelteKit" h1 assertion (it will fail
  once the boilerplate is replaced).

---

## Ordered steps
1. `src/app.css` — ramps, light defaults, system-dark media block, manual overrides, `@theme inline`,
   `--font-display`, `.label`/`.display`, retune `body`.
2. `src/app.html` — no-flash script + Fraunces links.
3. `src/lib/components/theme/themeToggle.svelte`.
4. `src/lib/components/landing/topBar.svelte` + `heroSearch.svelte`.
5. `src/routes/+page.svelte` (replace boilerplate).
6. `src/lib/components/theme/themeToggle.spec.ts`.
7. `tests/landing.spec.ts` + edit `tests/test.ts`.

## Verification
- `bun run test:unit` — toggle component test passes.
- `bun run test:integration` — landing e2e passes (headline, search focus, contribute link,
  theme switch + persistence across reload).
- `bun run check` — no type/svelte errors.
- Manual: `bun run dev`; cycle the toggle through all 3 states; hard-reload in dark mode to confirm
  **no flash**; in DevTools confirm `bg-surface`/`text-ink` recompute when `html[data-theme]`
  changes (validates the `@theme inline` choice). Check contrast on both themes.

## Risks / watch-items
- **`@theme inline` is mandatory** for the swap — a plain `@theme` silently fails to re-cascade.
  Verify in-browser first.
- **Do not delete legacy color ramps** in `app.css` — existing components depend on them.
- **`searchForm` fires `onaction` on every keystroke** — `heroSearch` must guard navigation to
  submit/commit only.
- **`tests/test.ts` will break** — edit it in the same change.
- `matchMedia` is undefined in jsdom — the Vitest test must stub it before render.
