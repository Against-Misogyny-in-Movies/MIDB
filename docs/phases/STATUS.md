# Phase status

Status is `not started`, `active`, or `completed`. This file keeps only what is current (`.claude/rules/docs-standards.md`).

## Rules

- **The live plans.** The phases are the sections of the live plans: rows T1–T3 (the toolchain, done) ran first; rows 0–6 come from `docs/plans/plan-cloudflare-d1-comments.md`. Their decisions are settled; only the user reopens them.
- **Starting a phase.**
  - If nothing is active, the only legal start is the lowest phase in the table whose earlier phases are completed.
  - When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active.
- **Completing a phase.**
  - A phase is `completed` when its exit is green (`.claude/rules/code-standards.md`, Checking a change) and the review round reports no blocks.
  - The review round is `.claude/agents/orchestrator.md`, One review round. A phase that changes `src/routes` or `src/lib/components` also needs `ux`, and one that changes user-facing text needs `copy-judge`.
  - Write the date.
- **Counts.** Current counts and limits live in code and are not copied here.

## Phases

| Phase | Work                   | Status      | Note                                                                                                      |
| ----- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| T1    | pnpm + Node 22         | completed   | 2026-11-12.                                                                                               |
| T2    | TypeScript 6 + TS 7    | completed   | 2026-11-12.                                                                                               |
| T3    | Oxlint + ESLint Svelte | completed   | 2026-11-12.                                                                                               |
| 0     | SvelteKit 3 upgrade    | completed   | 2026-11-12. Storybook builds on Kit 3; a story rendering in a browser is unverified.                      |
| 1     | Cloudflare platform    | completed   | 2026-11-12. Workers Caching checks wait for the first preview deploy (Open items).                        |
| 2     | SQLite / D1 data layer | completed   | 2026-11-12. `--remote` (`/raw`) is tested only against a mocked API until a real account exists.          |
| 2b    | Daily source sync      | completed   | 2026-11-12. The scheduled workflow has not run: it needs the canonical repo and its secrets (Open items). |
| 3     | Auth (Better Auth)     | completed   | 2026-11-12. Google and Discord sign-in are untested until their OAuth apps exist (Open items).            |
| 4     | Comments               | active      | 2026-11-12: implementer running.                                                                          |
| 5     | AI moderation          | not started |                                                                                                           |
| 6     | CI, deploy, docs       | not started |                                                                                                           |

## Open items

- **UX:**
  - Section footer links (`collapsibleSection.svelte`) are 20 px tall, under the 44 px touch target.
  - A film or series page that fails to load from TMDB shows the generic "Something went wrong" heading (`src/routes/+error.svelte`); name what failed.
  - Enter in the navbar search does nothing unless a row is highlighted; the landing search opens the first result.
- **Cloudflare:**
  - Replace the `REPLACE-WITH-…` values in `wrangler.jsonc` (D1 ids, origins, Turnstile site key) and check the rate-limit `namespace_id`s are unique in the account.
  - On the first preview deploy, check that a second request for a title page and for an image is a cache hit with the Worker not invoked (`wrangler tail`), and that a new comment purges its list.
- **Source sync:**
  - When the repository moves, update the `if: github.repository == …` guard in `.github/workflows/sync-sources.yml`, and set its secrets there.
  - Without `TMDB_API_TOKEN` the synced films have no TMDB id, so a contributor's local landing hero is empty.
- **Auth:**
  - Google and Discord sign-in and linking have run only against mocks; test them once their OAuth apps and secrets exist.
- **Attribution:**
  - The footer carries the TMDB notice as text; add the official TMDB logo asset.
- **Docs:**
  - Decide whether `docs/plans/done/` moves to the new public repository or is deleted (`.claude/rules/docs-standards.md`, Plans).
- **Sources:**
  - Write to the Unconsenting Media team (`/contactus`) about the daily `list.json` sync, and ask whether they would add IMDb ids.

## Standing decisions

- **Hosting:**
  - Cloudflare Workers on Workers Paid, with production on a custom domain in a Cloudflare zone (user decision, 2026-11-11).
  - D1 replaces Postgres, with a fresh start: no user data carries over (user decision, 2026-11-11).
  - SvelteKit 3 is upgraded in the same migration (user decision, 2026-11-11).
  - Deploys run through GitHub Actions (user decision, 2026-11-11).
- **Auth and comments:**
  - Better Auth with Google and Discord SSO and passkeys, passkey-only sign-up allowed, and no email/password (user decision, 2026-11-11).
  - Comments: threads, votes, history, human moderation, and tiered AI moderation on Claude Haiku 5.5 (user decision, 2026-11-11).
- **Auth limits and linking:**
  - `RL_AUTH` allows 30 requests a minute per IP (user decision, 2026-11-12).
  - Only Google is a trusted provider for linking by email; a Discord sign-in links only with a verified email (user decision, 2026-11-12).
  - OAuth access and refresh tokens are encrypted at rest (user decision, 2026-11-12).
- **Toolchain:**
  - pnpm and Node 22 replace Bun (user decision, 2026-11-12).
  - TypeScript 6.0.3 serves the tooling and TypeScript 7 runs `typecheck`, until svelte-check supports TypeScript 7 (user decision, 2026-11-12).
  - Oxlint lints TS and JS; ESLint is kept for Svelte templates only (user decision, 2026-11-12).
- **Source sync:**
  - Bechdel year pages are paginated and followed in full; films with no IMDb id are skipped and logged; an unreadable row fails the run; the daily run binds UM after Bechdel adds films (user decision, 2026-11-12).
- **Local preview:**
  - `pnpm preview` and e2e run the built Worker on `wrangler dev`, because adapter-cloudflare 8 emulates `cloudflare:workers` only in `vite dev` (user decision, 2026-11-12).
- **Sources and repository:**
  - Landing popularity comes from TMDB's daily export, not IMDb (user decision, 2026-11-12).
  - The code is published as a new open-source repository, so git history does not carry over (user decision, 2026-11-11).
