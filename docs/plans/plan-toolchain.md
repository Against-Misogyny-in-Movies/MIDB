# Plan: pnpm + Node 22, TypeScript 6/7 and Oxlint

> A live plan, run before `docs/plans/plan-cloudflare-d1-comments.md`. Its phases are rows T1–T3 of `docs/phases/STATUS.md`:
>
> - T1: the toolchain swap (sections 1–4);
> - T2: the latest TypeScript (section 5, plus the TypeScript half of section 7);
> - T3: Oxlint (section 6, plus the lint half of section 7).
>
> Each phase lands as its own commit, in that order.

## Context

MIDB uses Bun 1.4.4 as its package manager (`bun.lock`, `packageManager: bun@1.4.4`) and as its script runner. The scripts are run as `bun ./db/scripts/*.ts`. Bun-only features make that work:

- `import.meta.main`;
- extensionless relative imports;
- automatic `.env` loading.

CI, Vercel, the session hook, Playwright and every doc also call `bun`.

The user asked for an alternative and chose **pnpm + Node 22**, the toolchain of middle-earth-lcg (user decision, 2026-11-12):

- **pnpm** for installs, with a strict `node_modules` and `pnpm-lock.yaml`.
- **Node** for the `.ts` scripts. Node runs them through its built-in type stripping (the environment's Node 22.23 has it on by default, `process.features.typescript === 'strip'`) and loads `.env` with `--env-file-if-exists`.

The outcome is the same commands and behaviour with no Bun anywhere, and an unchanged verification baseline.

The user also asked for the latest TypeScript and for Oxlint (sections 5–6). The newest TypeScript the Svelte tooling can load is 6.0.3, so TypeScript 7.0.2 joins as a separate fast typecheck. Oxlint takes over TS/JS linting with type-aware rules. ESLint stays only for what Oxlint cannot read: Svelte templates.

What makes this possible:

- The repo calls no `Bun.*` APIs.
- The app code is bundled by Vite and is unaffected.
- `.svelte-kit/tsconfig.json` already sets `noEmit`, `verbatimModuleSyntax` and `isolatedModules`, which Node's type stripping needs.
- No enums, namespaces or parameter properties exist in `db/` or `scripts/`.

## Changes

### 1. Package manager

- **`package.json`:**
  - Set `"packageManager": "pnpm@10.28.0"`, the version installed at `/opt/node22`.
  - Add `"engines": { "node": ">=22.18" }`, the first Node 22 with type stripping on by default. `.npmrc`'s `engine-strict=true` enforces it.
  - Swap the dev dependency `@types/bun` for `@types/node@^22`.
- **Lockfile:** delete `bun.lock`, then run `pnpm install` to write `pnpm-lock.yaml`.
- **Version drift:** a scratch script in the session scratchpad (not committed) compares each package's resolved version in `bun.lock` (its `packages` map) with `pnpm-lock.yaml`.
  - Any direct dependency that resolved differently is pinned back with `pnpm.overrides`.
  - Transitive drift is reported in the commit body.
- **Dependency build scripts:** pnpm 10 blocks them by default. List the ones the install reports as ignored (expected: `esbuild` and the Tailwind/oxide native bindings) in `pnpm.onlyBuiltDependencies` in `package.json`, and nothing else.
- **`tsconfig.json`:**
  - Set `"types": ["node"]` instead of `bun-types`.
  - Add `"allowImportingTsExtensions": true` (allowed because kit's tsconfig sets `noEmit`).
  - Add `"erasableSyntaxOnly": true`, so `svelte-check` refuses any syntax Node cannot strip.

### 2. Scripts run on Node

- **`package.json` scripts:**

  | Bun form                                                                  | Node form                                        |
  | ------------------------------------------------------------------------- | ------------------------------------------------ |
  | `bun run vite dev`                                                        | `vite dev`                                       |
  | `bun ./db/scripts/x.ts`                                                   | `node --env-file-if-exists=.env db/scripts/x.ts` |
  | `bun scripts/…` (`commit:check`, `docs:index`, `docs:section`, `prepare`) | `node scripts/…`                                 |
  | `npm run` in `test`                                                       | `pnpm`                                           |

  The `db:*` scripts are `db:migrate`, `db:seed:movies`, `db:seed:um`, `db:backfill:tmdb` and `db:seed:admin`.

- **Explicit `.ts` extensions.** Every relative import in the Node-run import graph gets one, because Node ESM does not guess extensions. That graph is `db/client.ts`, `db/schema/*.ts`, `db/lib/*.ts`, `db/scripts/**/*.ts` and `db/test/global-setup.ts`; for example `from '../client'` becomes `from '../client.ts'`.
  - Vite and drizzle-kit resolve `.ts` specifiers too, so the app's `$db/*` imports keep working.
  - Node built-ins move to `node:` specifiers (`fs` → `node:fs`).
- **Entry-point checks.** Each `if (import.meta.main)` (Node 22 has no `import.meta.main`) becomes the entry-point check the repo's `scripts/` already use:

  ```ts
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  ```

  Files: `migrate.ts`, `migrateOnDeploy.ts`, `seedMovies.ts`, `seedUnconsenting.ts`. Define the check once, as `isMain(importMetaUrl)` in `scripts/lib/is-main.ts`. `scripts/git/commit-message.ts`, `scripts/docs/index.ts` and the db scripts all import it. Add a unit spec next to it.

- **`.env` loading.** Fix the comment in `db/scripts/lib/db.ts` ("Bun loads `.env`") to name `--env-file-if-exists`. In production, Vercel still provides env vars directly.
- **Other files:** update the usage strings and comments that say `bun run …` in `scripts/git/commit-message.ts`, `scripts/docs/index.ts` (the rendered INDEX header too) and `db/scripts/seedAdmin.ts`.

### 3. CI, hosting, hooks

- **`.github/workflows/tests.yml`:**
  - Every job replaces `oven-sh/setup-bun` with the pins middle-earth-lcg uses: `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0` and `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0` (`node-version: 22`, `cache: pnpm`).
  - `bun install --frozen-lockfile` becomes `pnpm install --frozen-lockfile`, and `bun run X` becomes `pnpm X`.
  - `bunx drizzle-kit` / `bunx playwright` become `pnpm exec …`.
  - The `commits` job runs `node scripts/git/commit-message.ts`. It needs no install, since the script uses only Node built-ins.
- **`.github/dependabot.yml`:** `package-ecosystem: npm` (this covers pnpm lockfiles).
- **`vercel.json`:**
  - `installCommand: "pnpm install --frozen-lockfile"`.
  - `buildCommand: "node db/scripts/migrateOnDeploy.ts && pnpm build"`.
  - Vercel's Node version comes from `engines`.
- **Other files:**
  - `playwright.config.ts`: `pnpm build && pnpm preview`.
  - `.claude/hooks/session-start.sh`: `corepack enable` (quiet), then `pnpm install --frozen-lockfile`, as middle-earth-lcg does. Keep the `.env` copy.
  - `.claude/settings.json`: the allow-list moves from `bun …` to `pnpm …` / `pnpm exec vitest …` / `node scripts/…`.
  - `.githooks/commit-msg`: `exec node scripts/git/commit-message.ts --file "$1"`.

### 4. Docs (current state only, per `.claude/rules/docs-standards.md`)

- **The mechanical rename:**
  - `bun run X` becomes `pnpm X`;
  - `bunx X` becomes `pnpm exec X` for a local dependency, or `pnpm dlx X` for a one-off;
  - `bun install` becomes `pnpm install`;
  - "Bun" becomes "pnpm"/"Node" in prose.
- **Where it applies:**
  - `AGENTS.md` (Commands, Cloud sessions), every file in `.claude/rules/` and `.claude/agents/`;
  - `README.md`, `CONTRIBUTING.md`, `SECURITY.md` (Supply chain: `pnpm-lock.yaml`);
  - `docs/architecture.md`: Tech stack, Directory layout (`bun.lock` → `pnpm-lock.yaml`, the `vercel.json` line), npm scripts, CI, Local run sequence;
  - `docs/phases/STATUS.md`;
  - the live plan `docs/plans/plan-cloudflare-d1-comments.md`. That covers its command examples, the `bunx auth generate` → `pnpm dlx auth generate` step, the `bun install` mentions, and the scripts' Node runner.
- **Not changed:** `docs/plans/done/` is history and stays untouched.
- **New rule** in `.claude/rules/code-standards.md`, File organisation:
  - Scripts under `db/` and `scripts/` run on Node's type stripping.
  - Their relative imports carry the `.ts` extension, and they use erasable syntax only (`erasableSyntaxOnly` enforces it).
  - An entry point uses `isMain` (`scripts/lib/is-main.ts`), and a script that reads `.env` is run with `--env-file-if-exists=.env`.
- **New standing decision** in `docs/phases/STATUS.md`: "pnpm + Node 22 replace Bun (user decision, 2026-11-12)".
- **The index:** `pnpm docs:index` regenerates `docs/INDEX.md`.

### 5. TypeScript: 6.0.3 for the tooling, 7.0.2 as a fast typecheck (user decision, 2026-11-12)

Facts checked 2026-11-12:

- **TypeScript 7.0.2.** It is npm `latest`, the native Go compiler. It exposes only an `unstable/*` JS API.
- **Peer ranges.** `svelte-check@4.7.8`, `svelte2tsx@0.7.63` and `@sveltejs/kit@3.2.0` all require `typescript ^6`. The current Kit 2.66 accepts `^5.3.3 || ^6.0.0`.

So:

- **TypeScript 6.** `typescript` becomes `~6.0.3`, the newest version the Svelte tooling, the editor and typescript-eslint's parser can load. `svelte-check` (`pnpm check`) keeps checking everything, `.svelte` included.
- **TypeScript 7.**
  - Add `"typescript7": "npm:typescript@7.0.2"` as a dev dependency. The alias avoids a clash with the package name, and its platform binaries come through its optionalDependencies.
  - New script: `"typecheck": "svelte-kit sync && node node_modules/typescript7/bin/tsc -p tsconfig.typecheck.json"`. The script calls the alias's `bin/tsc` directly. pnpm links the alias's `tsc` over TypeScript 6's, so `pnpm exec tsc` runs 7.0.2, while the `typescript` module that `svelte-check`, typescript-eslint and the editor load is 6.0.3 (its compiler: `node node_modules/typescript/bin/tsc`).
- **`tsconfig.typecheck.json`:**
  - It `extends: "./tsconfig.json"` and sets `"noEmit": true`.
  - It includes `src/**/*.ts`, `db/**/*.ts`, `scripts/**/*.ts`, `e2e-tests/**/*.ts` and `*.config.ts`, and excludes `.svelte-kit/output`.
  - If `.ts` files that import `.svelte` components fail to resolve, add a `declare module '*.svelte'` shim at `scripts/checks/svelte-modules.d.ts`. It is listed in this config's `files` only, so `svelte-check` never sees it.
- **Deprecations.** Fix any compiler option TypeScript 6 deprecates, because TypeScript 7 turns those into errors. Kit's generated config uses `paths` without `baseUrl`; check `esModuleInterop` and `sourceMap` too. Fix any new strictness errors TypeScript 6 or 7 reports, in code, not with `@ts-ignore`.
- **Checks.** `pnpm typecheck` joins the verification baseline and CI's `static` job.

### 6. Lint: Oxlint for TS/JS, ESLint only for Svelte templates (user decision, 2026-11-12)

The ESLint run takes about 6.7 s over 183 files, so speed is not the reason for Oxlint. Its value is type-aware rules on the async server code the live plan adds: D1 batches, `waitUntil`, cache purges, the moderation call. Svelte templates stay on `eslint-plugin-svelte`, which Oxlint cannot replace.

- **Packages:** add `oxlint@1.93.0` and `oxlint-tsgolint@7.0.2006`. The latter is oxlint's type-aware engine, built on TypeScript 7.
- **`.oxlintrc.json`:**
  - `plugins: ["typescript", "import", "unicorn", "oxc", "promise"]`, with categories `correctness: "error"` and `suspicious: "error"`.
  - Rules the code standards already state:
    - `no-unused-vars` (args and vars ignored when they match `^_`);
    - `typescript/no-explicit-any`;
    - `no-empty` (no empty `catch`);
    - `typescript/consistent-type-imports`.
  - Type-aware rules (run with `--type-aware`): `typescript/no-floating-promises`, `typescript/no-misused-promises`, `typescript/await-thenable`, `typescript/no-unnecessary-type-assertion`.
  - `ignorePatterns`: `.svelte-kit`, `build`, `.vercel`, `storybook-static`, `.claude/skills/impeccable`, `db/migrations`.
  - Oxlint also lints the `<script>` blocks of `.svelte` files.
- **`eslint.config.js`:**
  - Narrow it to `**/*.svelte` with `eslint-plugin-svelte`'s `flat/recommended` (`svelte-eslint-parser` with `@typescript-eslint/parser` for scripts), plus `eslint-config-prettier`.
  - Keep the existing `svelte/no-navigation-without-resolve: off`.
  - Drop `@typescript-eslint/eslint-plugin` and the TS/JS file blocks.
- **Scripts:**
  - `"lint": "prettier --check . && oxlint --type-aware --deny-warnings && eslint ."`;
  - add `"lint:fix": "oxlint --type-aware --fix && eslint . --fix"`.
- **Existing code.** Fix every new finding in code.
  - A deliberate fire-and-forget promise is written `void promise` (for example `onMount(() => void session.load())`).
  - A disable comment is allowed only with a reason on the same line, and the reason states why the rule is wrong there.
  - Report the number of findings fixed in the commit body.
- **Other files:**
  - `.vscode/extensions.json`: recommend `oxc.oxc-vscode`, alongside the existing Svelte entries.
  - CI: the `static` job runs `pnpm lint` as before, which now includes Oxlint.
  - `.claude/settings.json`: allow `pnpm lint`, `pnpm lint:fix`, `pnpm typecheck`.

### 7. Docs for sections 5–6

- **`.claude/rules/code-standards.md`:**
  - Checking a change: the baseline gains `pnpm typecheck` → 0 errors, and `pnpm lint` now means Prettier, Oxlint (type-aware) and ESLint for Svelte.
  - Making a change: no `oxlint-disable` / `eslint-disable` without a same-line reason; promises are awaited or explicitly `void`-ed.
- **Other docs:**
  - `AGENTS.md`, Commands: add `typecheck` and `lint:fix`.
  - `docs/architecture.md`: Tech stack, Directory layout (`.oxlintrc.json`, `tsconfig.typecheck.json`, `eslint.config.js` scope), CI.
  - `CONTRIBUTING.md`, the PR template's checklist (add `pnpm typecheck`) and the agent files' exits (orchestrator, implementer, reviewer).
  - The live plan's Phase 0 version list: `typescript@^6` stays `~6.0.3`, and TS 7 is noted as the typecheck.
- **Standing decisions in `docs/phases/STATUS.md`:**
  - TS 6.0.3 for the tooling and TS 7 for `pnpm typecheck`, until svelte-check supports TypeScript 7 (user decision, 2026-11-12).
  - Oxlint plus ESLint for Svelte only (user decision, 2026-11-12).

## Verification

1. **Clean install.** `rm -rf node_modules && pnpm install --frozen-lockfile`. It must succeed, report no ignored build scripts that matter, and set `core.hooksPath` through `prepare`.
2. **Version comparison.** The scratch drift check passes: direct dependencies match `bun.lock`, and transitive drift is listed.
3. **The baseline** (`.claude/rules/code-standards.md`, Checking a change):
   - `pnpm check` → 0 errors
   - `pnpm lint` → clean
   - `pnpm test:unit --run` → all pass
   - `pnpm test:db` → all pass, against the local Postgres 16 (`service postgresql start`; there is no Docker daemon here)
   - `pnpm build` → clean
4. **Node-run scripts, against the local Postgres:**
   - `pnpm db:migrate` on a fresh `midb` database;
   - `pnpm db:seed:movies`, then `pnpm db:seed:um` (the full seed CSVs);
   - `pnpm db:seed:admin` with no argument prints its usage;
   - `node db/scripts/migrateOnDeploy.ts` with no `VERCEL_ENV` skips;
   - `pnpm docs:index` leaves no diff;
   - `pnpm commit:check "repo: x"` passes and `"bad"` fails;
   - a test commit is refused by the hook.
5. **No Bun left.** `grep -rn "bun" --exclude-dir={node_modules,.git,docs/plans/done,.claude/skills}` finds nothing but `pnpm-lock.yaml` noise (for example `bun-types` in unrelated packages, if any).
6. **TypeScript.**
   - `pnpm exec tsc --version` → 7.0.2 (the alias's bin wins); `node node_modules/typescript/bin/tsc --version` → 6.0.3.
   - `node node_modules/typescript7/bin/tsc --version` → 7.0.2.
   - `pnpm typecheck` → 0 errors; record its time next to `pnpm check`'s.
   - Plant a deliberate type error in a scratch copy of a `.ts` file and confirm both `pnpm check` and `pnpm typecheck` fail on it, then revert.
7. **Lint.**
   - `pnpm lint` → clean. Time Oxlint and ESLint separately and report both against the 6.7 s ESLint baseline.
   - Prove each layer works:
     - a scratch floating promise in a server `.ts` file fails Oxlint (type-aware);
     - `{@html x}` in a scratch `.svelte` file fails ESLint (svelte plugin);
     - revert both.
8. **Commit and push**, as three commits:
   1. `repo: Replace Bun with pnpm and Node 22` (body: the drift report);
   2. `repo: Move to TypeScript 6 and add a TypeScript 7 typecheck`;
   3. `repo: Lint TS and JS with Oxlint, Svelte templates with ESLint` (body: the findings fixed and the timings).

   Each commit runs the baseline before it lands. Push them to `ccr-15978aa5-gk22gk`.
