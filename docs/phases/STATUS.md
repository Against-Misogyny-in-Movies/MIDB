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

| Phase | Work                   | Status      | Note                             |
| ----- | ---------------------- | ----------- | -------------------------------- |
| T1    | pnpm + Node 22         | completed   | 2026-11-12.                      |
| T2    | TypeScript 6 + TS 7    | completed   | 2026-11-12.                      |
| T3    | Oxlint + ESLint Svelte | completed   | 2026-11-12.                      |
| 0     | SvelteKit 3 upgrade    | active      | 2026-11-12: implementer running. |
| 1     | Cloudflare platform    | not started |                                  |
| 2     | SQLite / D1 data layer | not started |                                  |
| 2b    | Daily source sync      | not started |                                  |
| 3     | Auth (Better Auth)     | not started |                                  |
| 4     | Comments               | not started |                                  |
| 5     | AI moderation          | not started |                                  |
| 6     | CI, deploy, docs       | not started |                                  |

## Open items

- **UX:**
  - A film or series page that fails to load from TMDB shows the generic "Something went wrong" heading (`src/routes/+error.svelte`); name what failed.
  - Enter in the navbar search does nothing unless a row is highlighted; the landing search opens the first result.
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
- **Toolchain:**
  - pnpm and Node 22 replace Bun (user decision, 2026-11-12).
  - TypeScript 6.0.3 serves the tooling and TypeScript 7 runs `typecheck`, until svelte-check supports TypeScript 7 (user decision, 2026-11-12).
  - Oxlint lints TS and JS; ESLint is kept for Svelte templates only (user decision, 2026-11-12).
- **Sources and repository:**
  - Landing popularity comes from TMDB's daily export, not IMDb (user decision, 2026-11-12).
  - The code is published as a new open-source repository, so git history does not carry over (user decision, 2026-11-11).
