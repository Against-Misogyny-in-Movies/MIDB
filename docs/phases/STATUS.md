# Phase status

Status is `not started`, `active`, or `completed`. This file keeps only what is current (`.claude/rules/docs-standards.md`).

## Rules

- **The live plans.** Each phase row comes from a live plan in `docs/plans/`. A completed row's plan is deleted; the behaviour it built is owned by `docs/architecture.md`, `DESIGN.md` and the rules. Settled decisions are listed under Standing decisions; only the user reopens them.
- **Starting a phase.**
  - If nothing is active, the only legal start is the lowest phase in the table whose earlier phases are completed.
  - When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active.
- **Completing a phase.**
  - A phase is `completed` when its exit is green (`.claude/rules/code-standards.md`, Checking a change) and the review round reports no blocks.
  - The review round is `.claude/agents/orchestrator.md`, One review round. A phase that changes `src/routes` or `src/lib/components` also needs `ux`, and one that changes user-facing text needs `copy-judge`.
  - Write the date.
- **Counts.** Current counts and limits live in code and are not copied here.

## Phases

| Phase | Work                             | Status      | Note                                                                                                                               |
| ----- | -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| T1    | pnpm + Node 22                   | completed   | 2026-11-12.                                                                                                                        |
| T2    | TypeScript 6 + TS 7              | completed   | 2026-11-12.                                                                                                                        |
| T3    | Oxlint + ESLint Svelte           | completed   | 2026-11-12.                                                                                                                        |
| 0     | SvelteKit 3 upgrade              | completed   | 2026-11-12. Storybook builds on Kit 3; a story rendering in a browser is unverified.                                               |
| 1     | Cloudflare platform              | completed   | 2026-11-12. Workers Caching checks wait for the first preview deploy (Open items).                                                 |
| 2     | SQLite / D1 data layer           | completed   | 2026-11-12. `--remote` (`/raw`) is tested only against a mocked API until a real account exists.                                   |
| 2b    | Daily source sync                | completed   | 2026-11-12. The scheduled workflow has not run: it needs the canonical repo and its secrets (Open items).                          |
| 3     | Auth (Better Auth)               | completed   | 2026-11-12. Google and Discord sign-in are untested until their OAuth apps exist (Open items).                                     |
| 4     | Comments                         | completed   | 2026-11-12.                                                                                                                        |
| 5     | AI moderation                    | completed   | 2026-11-12. The classifier has run only against a mocked SDK until `ANTHROPIC_API_KEY` exists (Open items).                        |
| 6     | CI, deploy, docs                 | completed   | 2026-11-12. The workflows have not run against a real account (Open items).                                                        |
| 7     | Avatars and usernames            | completed   | 2026-11-12.                                                                                                                        |
| R1    | Reader reports: data             | completed   | 2026-11-12.                                                                                                                        |
| R2    | Reader reports: API              | completed   | 2026-11-13.                                                                                                                        |
| R3    | Reader reports: moderation       | completed   | 2026-11-13. The tab has been reviewed from code only, not in a browser.                                                            |
| R4    | Reader reports: UI               | completed   | 2026-11-13. Not rendered in a browser (no TMDB token here); the reserved counts height is computed, not measured.                  |
| R5    | Reader reports: copy and docs    | completed   | 2026-11-13.                                                                                                                        |
| C1    | Community reports: rename        | completed   | 2026-11-13. The migration keeps its name `0001_reader_reports`.                                                                    |
| C2    | Community reports: staff         | completed   | 2026-11-13.                                                                                                                        |
| C3    | Community reports: header badge  | completed   | 2026-11-13. Not rendered in a browser (no TMDB token here).                                                                        |
| C4    | Community reports: flow          | completed   | 2026-11-13. Not rendered in a browser (no TMDB token here).                                                                        |
| M1    | Moderation table: data           | completed   | 2026-11-13.                                                                                                                        |
| M2    | Moderation table: AI             | completed   | 2026-11-13. The scan and query calls have run only against a mocked SDK (Open items).                                              |
| M3    | Moderation table: UI             | completed   | 2026-11-13. Rendered against seeded local data only; the AI controls seen only in their disabled state.                            |
| M4    | Moderation table: docs           | completed   | 2026-11-13.                                                                                                                        |
| S1    | Staff powers and rate limits     | completed   | 2026-11-13. Moderation rows reviewed from code only, not rendered.                                                                 |
| S2    | DDD section starts closed        | completed   | 2026-11-13. Not rendered in a browser (no TMDB token here).                                                                        |
| S3    | Snappy comment votes             | completed   | 2026-11-13. Not rendered in a browser; voter-fresh scores came after the review round.                                             |
| S4    | Links to a comment               | completed   | 2026-11-13. Not rendered in a browser; `e2e-tests/commentLinks.spec.ts` not run (no TMDB token here).                              |
| S5    | Public user profiles             | completed   | 2026-11-13. `/u` rendered on seeded local data; moderation name links reviewed from code only.                                     |
| S6    | Letterboxd score                 | completed   | 2026-11-13. Never run against the real API: no key exists (Open items).                                                            |
| SH1   | Security: moderation sticks      | completed   | 2026-11-14. Reviewed with SH2–SH5 in one round; its findings are fixed.                                                            |
| SH2   | Security: sock puppets           | completed   | 2026-11-14. Burst holds are not re-checked after their window (Open items).                                                        |
| SH3   | Security: accounts               | completed   | 2026-11-14. Sign-up refuses without `TURNSTILE_SECRET_KEY` off localhost: set it in production.                                    |
| SH4   | Security: platform               | completed   | 2026-11-14. Title pages not rendered with the CSP (no TMDB token here); sources load from the browser.                             |
| SH5   | Security: username shape         | completed   | 2026-11-14. The vote lock for new accounts is tested in specs, not seen in a browser.                                              |
| P1    | Profile: data                    | completed   | 2026-11-14.                                                                                                                        |
| P2    | Profile: page                    | completed   | 2026-11-14. Rendered on seeded local data; dark theme not seen.                                                                    |
| P3    | Profile: settings and docs       | completed   | 2026-11-14. The passkey e2e specs time out on sign-up in the cloud container, before this change too.                              |
| A1    | Settings: structure              | completed   | 2026-11-17. Rendered on seeded local sessions; the Link buttons seen only with dummy provider credentials.                         |
| A2    | Settings: sessions               | completed   | 2026-11-17.                                                                                                                        |
| A3    | Settings: appearance             | completed   | 2026-11-17.                                                                                                                        |
| A4    | Settings: account data           | completed   | 2026-11-17.                                                                                                                        |
| A5    | Delete account: data             | completed   | 2026-11-17. Scrub time on a large account is unmeasured.                                                                           |
| A6    | Delete account: page             | completed   | 2026-11-17. A real deletion ran on local D1; the sign-in after a stale session's sign-out was not exercised.                       |
| B1    | Profile: stats data              | completed   | 2026-11-17.                                                                                                                        |
| B2    | Profile: stats page              | completed   | 2026-11-17. Measured on seeded local data; title links not followed (no TMDB token).                                               |
| D1    | Profile and settings: docs       | completed   | 2026-11-17. A2 to D1 were reviewed in one round; the fixes were not reviewed again.                                                |
| MR1   | Moderation: server structure     | completed   | 2026-11-17. Review waits for the plan's one final round.                                                                           |
| MR2   | Moderation: tabs, counts, paging | completed   | 2026-11-18. Review waits for the final round.                                                                                      |
| MR3   | Moderation: rule fixes           | completed   | 2026-11-18. Review waits for the final round.                                                                                      |
| MR4   | Moderation: priority order       | completed   | 2026-11-18. Review waits for the final round. The priority order reads `ai_verdict` per row; unmeasured on a large Reported queue. |
| MR5   | Moderation: schema               | active      | 2026-11-18. `docs/plans/plan-moderation.md`.                                                                                       |
| MR6   | Moderation: reversals            | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR7   | Moderation: rule-based reasons   | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR8   | Moderation: queue and panel      | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR9   | Moderation: keyboard triage      | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR10  | Moderation: account view         | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR11  | Moderation: log tab              | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR12  | Moderation: staff roles          | not started | `docs/plans/plan-moderation.md`.                                                                                                   |
| MR13  | Moderation: docs and copy        | not started | `docs/plans/plan-moderation.md`.                                                                                                   |

## Open items

- **Community reports:**
  - Render the title-page section, the header badge, the form and the moderation tab in a browser (no TMDB token here), and measure the counts slot's reserved height at phone and desktop widths; check the compact flag rows when a legend wraps.
  - Once the reader reports have deployed, add the migration that drops `community_bechdel_ratings`, `community_um_reports` and `community_ddd_votes` (`docs/architecture.md`, Known gaps).
- **UX:**
  - Section footer links (`collapsibleSection.svelte`) are 20 px tall, under the 44 px touch target.
  - A film or series page that fails to load from TMDB shows the generic "Something went wrong" heading (`src/routes/+error.svelte`); name what failed.
  - Enter in the navbar search does nothing unless a row is highlighted; the landing search opens the first result.
- **Cloudflare:**
  - Run the first production and preview deploys through `deploy.yml` once the accounts, secrets and variables exist (`README.md`, Deploying a copy), and check the Workers Caching items below on them.
  - The `--remote` scripts (`/raw` over the D1 REST API) have run only against a mocked API; confirm them on the first remote load.
  - Replace the `REPLACE-WITH-…` values in `wrangler.jsonc` (D1 ids, origins, Turnstile site key) and check the rate-limit `namespace_id`s are unique in the account.
  - On the first preview deploy, check that a second request for a title page and for an image is a cache hit with the Worker not invoked (`wrangler tail`), and that a new comment purges its list.
- **Source sync:**
  - When the repository moves, update the `if: github.repository == …` guards in `.github/workflows/sync-sources.yml` and `deploy.yml`, and set the secrets and variables there.
  - Without `TMDB_API_TOKEN` the synced films have no TMDB id, so a contributor's local landing hero is empty.
- **Comments:**
  - The footer below a populated comment list moves when the list replaces its skeleton (CLS about 0.13–0.15); the reserved box cannot know the list's height.
  - Posting a comment inserts the reader's own row into the list, which moves the content below it.
  - Mute and ban have no undo: there is no unmute or unban action.
- **Moderation:**
  - The Claude Haiku 5.5 check has run only against a mocked SDK; run a few real comments through it once `ANTHROPIC_API_KEY` is set, and review the blocklist and system prompt against real traffic.
  - The moderation table's AI search and scan have run only against a mocked SDK; once `ANTHROPIC_API_KEY` is set, run a few searches and a page scan, and check the filters and labels they produce.
  - The All comments table has been rendered only against seeded local data, without its AI controls enabled; check it against real traffic, in the dark theme and on a touch device.
  - Time a bulk action on a full page of 50 comments on a deployed Worker.
- **Auth:**
  - Google and Discord sign-in and linking have run only against mocks; test them once their OAuth apps and secrets exist.
- **Attribution:**
  - The footer carries the TMDB notice as text; add the official TMDB logo asset.
- **Docs:**
  - Decide whether `docs/plans/done/` moves to the new public repository or is deleted (`.claude/rules/docs-standards.md`, Plans).
- **Sources:**
  - Write to the Unconsenting Media team (`/contactus`) about the daily `list.json` sync, and ask whether they would add IMDb ids.

- **Letterboxd:**
  - Test the client against the real API once keys exist; the assumptions are listed in `src/lib/server/integrations/letterboxd.ts`.
- **Settings:**
  - `ui/skeletonRows` serves the settings cards only; the comments, community reports, Does the Dog Die and moderation skeletons still carry their own copy of the stylesheet.
  - At 320px a passkey row clips its kind ("Can sync between devices") to keep the row height fixed.
  - Check the `RL_SESSIONS`, `RL_EXPORT` and `RL_DELETE_ACCOUNT` namespace ids are unique in the Cloudflare account.
  - The daily cleanup's skip of deleted accounts and its removal of their retired usernames have run only on a local D1; confirm them on the first remote run.
  - Time an account deletion on an account with many comments on a deployed Worker.
  - The navbar theme toggle's label names Light or Dark while the theme follows the device.
- **Design system:**
  - A selected chip (Appearance, the profile tabs, the comment sort, the moderation tabs) differs from the others by colour alone.
  - The Not public tab offers Edit and Delete as text actions; the public rows use the "More actions" menu.
  - A visitor's profile comment rows keep the owner's menu corner free, which narrows each first line on a phone.
  - No plate closes on Escape.
- **Profile:**
  - On a 320px screen the owner's three tabs scroll sideways.
  - The owner's empty lists show the plain line, without the hint about where comments and community reports are written.
  - A comment its owner deletes stays on the public list, marked deleted, until the page reloads.
  - Run `e2e-tests/passkeys.spec.ts` where passkey sign-up works; it times out in the cloud container.
- **Comment links and profiles:**
  - Run `e2e-tests/commentLinks.spec.ts` once a TMDB token and the preview environment exist, and render a linked comment and the profile name links in moderation in a browser.

- **Security:**
  - Render a film and a series page under the CSP once a TMDB token exists, and check the Does the Dog Die and Letterboxd slots fill from `/api/titles/[kind]/[tmdbId]/sources`.
  - A community report held as a burst is not re-checked once its window passes; a moderator clears it.
  - Two accounts renaming to look-alike names at the same moment can both succeed: only `lower(username)` has a unique index.
  - A bulk action where every selected row was edited answers `bulk-unchanged` without the edited count.

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
- **Comments:**
  - Every new account gets a generated username (`{feminist icon}_{4 digits}`), which the reader can change (user decision, 2026-11-12).
  - A deleted comment keeps its text, hidden from other readers and still visible to its author and moderators (user decision, 2026-11-12).
- **Community reports:**
  - Readers report what a title shows (five categories, sexual violence through UM's flags), not a safety score; reports never change the verdict (user decision, 2026-11-12).
  - Sexual violence is answered Not shown / Present / Not sure; UM's flags are asked only on Present, and no level is derived from them (user decision, 2026-11-12).
  - Reports count after an account-age wait; contradicting UM, a burst on a title or a busy new account holds a report for a moderator; readers can flag a title's counts (user decision, 2026-11-12).
  - The community Bechdel and DDD tables are dropped, after the reader reports deploy (user decision, 2026-11-12).
- **Moderation table:**
  - Staff get an All comments table on `/user/moderation` with Haiku search (a query becomes filters) and a page scan that stores labels; it covers comments and their reader reports, not community reports (user decision, 2026-11-13).
  - The classifier also tags violence, disparagement and trolling (user decision, 2026-11-13).
- **Profile and settings:**
  - Account deletion is immediate and scrubs the `user` row instead of deleting it; a deleted account's comments with another account's comment below them lose their text and stay (user decision, 2026-11-17).
  - The sessions list shows browser and day, not the IP address; the data download carries it (user decision, 2026-11-17).
- **Moderation** (`docs/plans/plan-moderation.md`, Decisions):
  - Moderation reasons are a rule from a fixed list, published on `/resources`; lifting a ban restores sign-in only; only administrators lift bans (user decision, 2026-11-17).
  - Staff notes on an account are left out of its data download (user decision, 2026-11-17).
- **Community polish:**
  - Administrators act on any account and comment, their own and other administrators' included, except muting or banning themselves (user decision, 2026-11-13).
  - Staff are not rate-limited, except on the AI moderation calls (user decision, 2026-11-13).
  - Public profiles show avatar, name, join date, staff role, comment score total, published comments and counted community reports (user decision, 2026-11-13).
  - One profile page at `/u/<username>` for visitors and its owner, who also gets Edit profile and Settings; account security lives on `/user/settings` (user decision, 2026-11-14).
  - Votes do not purge the cached comment list; the reader's private viewer state carries current scores for comments they voted on (user decision, 2026-11-13).
  - Film pages show the Letterboxd average rating from the official API with a secret key, as the only outside rating (user decision, 2026-11-13).
- **Security hardening:**
  - Film and series pages load the Does the Dog Die warnings and the Letterboxd rating from the browser, through a public endpoint, so the hash CSP stays strict (user decision, 2026-11-13).
  - A new username is 4 to 32 characters, starts with a letter, has no `_` at either end or twice in a row, and may not look like another account's name once `1`→`l` and `0`→`o` are folded; stored names are checked only when they change (user decision, 2026-11-13).
- **Toolchain:**
  - pnpm and Node 22 replace Bun (user decision, 2026-11-12).
  - TypeScript 6.0.3 serves the tooling and TypeScript 7 runs `typecheck`, until svelte-check supports TypeScript 7 (user decision, 2026-11-12).
  - Oxlint lints TS and JS; ESLint is kept for Svelte templates only (user decision, 2026-11-12).
- **Source sync:**
  - Bechdel year pages are paginated and followed in full; films with no IMDb id are skipped and logged; an unreadable row fails the run; the daily run binds UM after Bechdel adds films (user decision, 2026-11-12).
- **Previews:**
  - Same-repo pull requests deploy the shared preview Worker (`wrangler deploy --env preview`); the latest push wins (user decision, 2026-11-12).
- **Local preview:**
  - `pnpm preview` and e2e run the built Worker on `wrangler dev`, because adapter-cloudflare 8 emulates `cloudflare:workers` only in `vite dev` (user decision, 2026-11-12).
- **Sources and repository:**
  - Landing popularity comes from TMDB's daily export, not IMDb (user decision, 2026-11-12).
  - The code is published as a new open-source repository, so git history does not carry over (user decision, 2026-11-11).
