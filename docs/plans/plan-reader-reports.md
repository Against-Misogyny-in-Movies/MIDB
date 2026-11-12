# Plan: reader reports of violence against women

Its phases are rows R1–R5 in `docs/phases/STATUS.md`.

## Context

Readers add community input to each title. It is not a score ("1 to 5, how safe is it to watch"), because:

- what counts as "safe" differs from reader to reader, so an average says nothing to any one of them;
- an average hides disagreement and can falsely reassure the readers who avoid this content for their own safety;
- it would compete with the safety verdict on the same page;
- it is opinion on an evidence-based site;
- a star score is easy to brigade.

Instead, **readers who watched a title report what it shows.** The value is coverage: most films have no Unconsenting Media entry, and no source covers non-sexual violence against women, or objectification, at all.

The repo has unused, empty community tables (`db/schema/community.ts`: Bechdel 0–3, UM 9 flags, DDD votes) with no write path. `/user/metrics` shows an empty history built on them.

### Settled with the user (2026-11-12)

- **Scope.** Reports cover women and girls, trans women included, in five categories:
  - Sexual violence
  - Partner or family abuse
  - Physical violence or murder
  - Stalking or harassment
  - Sexual objectification
- **Levels for the four violence categories:** Not shown / Mentioned or implied / On screen / Not sure.
- **Sexual violence detail.** "Shown" opens UM's 8 concern flags (`UM_FLAGS` in `src/lib/media/utils/metrics.ts`), each Yes / No / Not sure, so reader counts line up row by row with UM's entry.
- **Sexual objectification.**
  - It has its own levels: Not present / In some scenes / Throughout / Not sure.
  - A one-line description says what counts: the camera dwelling on women's bodies, women written only as sexual objects.
  - It is not a UM flag, so the match with UM stays exact.
  - Because it is not violence, the section and the Methodology copy say "violence against women and sexual objectification".
- **Framing.** One optional question on how the title treats the violence, shown as counts.
- **The verdict.** Reports never change the verdict (`verdict.ts` is untouched) and are shown beside it.
- **Other tables.** Safety reports only. The community Bechdel and DDD tables are dropped.
- **Counting and moderation:**
  - a report counts once its account is old enough;
  - three rules hold a report for a moderator: it contradicts UM, it is part of a burst on one title, or it comes from a busy new account;
  - readers can flag a title's counts as wrong.

### Decisions made in this plan (the user can reopen them)

- **One report per account per title**, whole title (a series report covers any episode). A reader can edit or delete their report.
- **The form opens with "I watched this"**, required.
- **Counts appear only at a minimum number of counted reports.** Below that the section says how many there are, with no breakdown.
- **Terms.** Copy calls them "reader reports", and the flag on a title is "Counts look wrong". In code they are `content_report` and `count_flag`, because `comment_reports` and `RL_REPORT` already belong to comment reporting. `copy-judge` confirms the terms.
- **The burst rule uses a fixed threshold** (N reports on one title within a window) for v1, not a baseline per title.
- **The account-age rule is applied when the counts are read, not stored as a status.** A report starts counting when its account comes of age, with no scheduled job. A cached count can lag by its TTL.

## Vocabulary and thresholds (client-safe, defined once)

`src/lib/media/utils/readerReports.ts` holds the shared vocabulary. Its enum tuples live in `db/lib/readerReports.ts`, which the schema imports, the way `db/lib/comments.ts` / `media/utils/comments.ts` do.

- `REPORT_CATEGORIES`: `sexual`, `partner`, `physical`, `stalking`, `objectification`, each with a sentence-case label, a one-line form description, and the level set it uses.
- `REPORT_LEVELS`: `none`, `mentioned`, `on_screen`. `OBJECTIFICATION_LEVELS`: `none`, `some_scenes`, `throughout`. NULL means not sure.
- `REPORT_FRAMINGS`: `condemned` (shown as wrong, with consequences), `unclear`, `played_for_laughs`, `glamorised_or_justified`. NULL means not answered.
- `contentReportStatus`: `counted`, `held`, `rejected`. `holdReason`: `contradicts_source`, `burst`, `busy_new_account`.
- The thresholds, so Methodology copy can import them instead of restating numbers:
  - `READER_REPORT_MIN`;
  - `REPORT_ACCOUNT_MIN_AGE_DAYS`;
  - `BURST_WINDOW_HOURS` and `BURST_COUNT`;
  - `NEW_ACCOUNT_DAYS` and `NEW_ACCOUNT_REPORT_MAX`.
- The sexual category's level comes from its flags (on screen if `rapeOnScreen`, `sexHarOnScrn`, `childSexAbuse`, …). That mapping is written once, here.

## Phases

### R1: Data

- **`db/schema/community.ts`.** Add `community_content_reports`:
  - `user_id`, `title_id` (both cascade), PK `(user_id, title_id)`, an index on `(title_id, status)` and one on `(user_id, created_at)`;
  - `partner_level`, `physical_level`, `stalking_level`, `sexual_present`, `objectification_level`: nullable enums with `enumCheck`, each against its own tuple;
  - the 8 UM concern flags as **nullable** booleans, from a nullable variant beside `umFlagColumns()` in `db/schema/columns.ts`, so the flag list is declared once;
  - `framing` (nullable enum);
  - `status` (default `counted`) and `hold_reason` (nullable);
  - `timestamps()`.
- **Add `title_count_flags`:**
  - `id`, `title_id`, `reporter_id` (cascade);
  - an optional `note` (≤ `REPORT_NOTE_MAX`, CHECK);
  - `status` (`reportStatus`: open / resolved / dismissed), `resolved_by` (set null);
  - `timestamps()`;
  - a unique `(title_id, reporter_id)` and an index on `(status, title_id)`.
- **The migration** comes from `pnpm db:generate`. It is additive; the old tables stay until the cleanup PR.
- **`src/lib/server/data/reader-reports.ts`:**
  - `upsertReport` resolves the title with `getOrCreateTitleRow`, runs the hold rules, and writes the status. An edit runs the rules again. A `rejected` report stays rejected.
  - `deleteReport` and `getViewerReport(userId, titleId)`. The viewer's report includes its status and the date it starts counting.
  - `getReportCounts(titleId)` counts only reports that are `counted`, whose account is at least `REPORT_ACCOUNT_MIN_AGE_DAYS` old, and that is not muted or banned. It returns the total and the level counts per category and per flag, in one grouped query per kind, through the query builder.
- **`src/lib/server/data/reader-report-holds.ts`.** The three rules as pure checks over the loaded facts, so they can be unit-tested:
  - **contradicts the source.** The title has a UM binding with any concern flag, and the report says sexual violence "Not shown", or "No" to a flag UM marks. "Not sure" never triggers it.
  - **burst.** At least `BURST_COUNT` reports on the title within `BURST_WINDOW_HOURS`. New reports in the window are held.
  - **busy new account.** The account is younger than `NEW_ACCOUNT_DAYS` and has more than `NEW_ACCOUNT_REPORT_MAX` reports.
- **`src/lib/server/data/count-flags.ts`:** `flagCounts`, `resolveCountFlag` and `dismissCountFlag`.
- **`getUserRatings`** in `user-queries.ts` reads the new table instead of the Bechdel and UM tables.
- **Tests:**
  - `reader-reports.db.spec.ts`:
    - upsert overwrites;
    - delete;
    - the counts leave out held, rejected, under-age, muted and banned reports;
    - an edit runs the rules again.
  - `reader-report-holds.spec.ts`: each rule, both ways, including "Not sure" never contradicting.
  - `count-flags.db.spec.ts`.
  - `db/test/community.db.spec.ts`: the CHECKs.

### R2: Reader API

Follow the comments routes (`src/routes/api/titles/[kind]/[tmdbId]/comments/`):

- **`GET /api/titles/[kind]/[tmdbId]/reports`.** Public counts, the same for everyone.
  - Uses `PUBLIC_READER_REPORTS` and `readerReportsTag(kind, tmdbId)`, new in `src/lib/server/http/cache.ts`, set after the lookup succeeds.
  - Below the minimum it returns `{ total }` only.
- **`GET …/reports/viewer`.** The reader's own report and its status. `PRIVATE_NO_STORE`, `requireUser`.
- **`PUT …/reports` and `DELETE …/reports`.**
  - `requireUser`, and refused for muted or banned accounts (`mute.ts`).
  - The body is validated against the vocabulary, and "I watched this" must be true.
  - A write purges the tag.
  - It calls `rateLimit({ userId })` outside any `try`, on the new bucket `RL_CONTENT_REPORT`. The bucket is added to `wrangler.jsonc` (both envs, unique `namespace_id`), to `RateLimitBucket` and to its memory fallback.
- **`POST …/reports/flag`.** "Counts look wrong", with an optional note.
  - `requireUser`, not muted or banned, one per account per title (an upsert).
  - Rate-limited on the existing `RL_REPORT` bucket, which already limits reports to moderators.
- **Tests.** A `*.db.spec.ts` beside `src/__tests__/api-comments-moderation.db.spec.ts`:
  - 401 signed out and 403 banned;
  - validation;
  - the hold status returned;
  - the purge called;
  - the cache headers;
  - the flag upsert.

### R3: Moderation tools

- **Action log.**
  - Add `approve_report`, `reject_report`, `reject_account_reports`, `resolve_count_flag` and `dismiss_count_flag` to `moderationAction` (`db/lib/comments.ts`).
  - Add a nullable `target_title_id` (set null) to `moderation_actions`.
  - The CHECK change rebuilds the table: the generated migration, with `PRAGMA defer_foreign_keys = on`. The old Worker writes only old values, so the change is safe while it still serves.
- **`src/lib/server/data/reader-report-moderation.ts`:**
  - `approveReport` and `rejectReport`;
  - `rejectAccountReports(userId)`;
  - the held queue;
  - the flagged-titles queue;
  - `listTitleReports(titleId)`, which returns every report with its account's username, account age, report count, comment count and status.
  - Each action writes the log and purges the title's tag in one `db.batch()`.
- **Mute and ban purge counts.** `muteUser` and `banAccount` (`moderation-actions.ts`) also purge the counts tag of every title the account reported, through `chunkForD1`, because the counts leave muted and banned accounts out.
- **`/user/moderation`.** A "Reader reports" tab beside the comment queues, gated by `requireRole`:
  - **Held:** each report with its title, the account (username, age, its report count), the hold reason, and its answers next to UM's flags when the reason is `contradicts_source`. Actions: Count it / Reject.
  - **Flagged titles:** each title with its open flags and notes. It opens the title's reports, where a moderator can reject a report, reject every report from that account, or mute or ban the account, and resolve or dismiss the flags.
  - The action log shows the new actions.
- **Tests.**
  - db specs for each action: it logs, changes the counts and purges, and rejecting an account's reports covers every title.
  - The `requireRole` guard on the endpoints.

### R4: Reader UI

Through `ux` and the Impeccable skill, against `DESIGN.md`.

- **Placement.** A "Reader reports" `CollapsibleSection` (`#lib/components/movies/sections/collapsibleSection.svelte`) right after `UmMetricSection` on both detail pages, with Methodology as its link. It is built once, in `#lib/components/movies/metrics/readerReportsSection.svelte`.
- **The counts.**
  - One row per category ("On screen 4 · Mentioned 1 · Not shown 2, of 7").
  - Sexual violence expands to the UM flag rows in the shared marker language (`.flag-*`, `docs/architecture.md`, Shared marker pattern).
  - Numbers are `tabular-nums` in `--ink`, with no coloured digits.
  - Framing comes last.
  - A quiet "Counts look wrong" `.link` at the foot opens a small form with an optional note.
- **States, in reserved fixed-size slots, with `aria-busy` while loading:** loading; below the minimum; counts. The reader's own report shows "Your report · Edit" and its status:
  - counted;
  - counts from a date (account age);
  - waiting for review (held);
  - not counted (rejected).
- **The form** (dialog or inline, phone first):
  1. "I watched this" (required).
  2. The 4 violence categories: Not shown / Mentioned or implied / On screen / Not sure.
  3. When sexual violence is shown: the 8 UM flags, each Yes / No / Not sure.
  4. Sexual objectification: Not present / In some scenes / Throughout / Not sure.
  5. When any violence category is shown: the optional framing question.
  6. Save is the one `.btn--brand`; Delete is ghost.
- **Signed out:** "Sign in to add a report". The section reads the client session (`session.svelte.js`), because the page is `PUBLIC_PAGE`.
- **`/user/metrics`** lists the account's reader reports, each with its status, and links each title.
- **Tests:** component tests for the gate logic and the status line.

### R5: Copy and docs

- **`/resources` (Methodology).** A "Reader reports" section, importing the thresholds from `readerReports.ts`. It states:
  - the categories and levels;
  - who can report;
  - the minimum number of reports;
  - the account-age wait;
  - the three hold rules;
  - that moderators review flagged counts;
  - that muted and banned accounts are not counted;
  - that reports never change the verdict.

  `copy-judge` checks it against the code.

- **`PRODUCT.md`:**
  - surfaces;
  - the safety lens, wider for reports;
  - the moderation surface.
- **`PRIVACY.md`, Ratings and comments:**
  - what a report and a count flag store;
  - that moderators see who reported and others see only counts;
  - the moderation log entries.
- **`SECURITY.md`:** the new write endpoints, the hold rules and the rate limits.
- **`DESIGN.md`:** the new section and the moderation tab.
- **`docs/architecture.md`:**
  - routes and the file map;
  - community tables;
  - Comments (or a new Reader reports section);
  - Caching policy;
  - the Known gaps item removed.

### Cleanup (a separate PR, after R1–R5 have deployed)

A migration dropping `community_bechdel_ratings`, `community_um_reports` and `community_ddd_votes`. The old Worker reads them in `getUserRatings`, and a migration must work while that version still serves.

## Out of scope (not built)

- Reports changing the verdict.
- Per-episode reports.
- Scene timestamps.
- Free-text notes on a report.
- A burst baseline per title.
- An undo for mute and ban (an existing open item).

## Verification

- **Each phase ends green on the baseline** (`.claude/rules/code-standards.md`, Checking a change):
  - `pnpm check`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test:unit --run`
  - `pnpm test:db`
  - `pnpm build`

  `pnpm db:generate` shows no drift after R1 and R3.

- **End to end on `pnpm preview`,** with test accounts whose `created_at` is backdated in the local D1:
  - an aged account reports a film with no UM entry, and the section shows "1 reader report" with no breakdown;
  - two more aged accounts report, and the counts appear;
  - a new account's report shows its counts-from date and is left out of the counts;
  - a report saying "Not shown" on a film UM flags is held; it appears in the moderation queue, and "Count it" adds it to the counts;
  - several reports on one title within the burst window are held;
  - flagging a title puts it in the flagged queue, and rejecting every report from one account drops them from the counts on every title;
  - banning an account drops its reports, and the counts response is purged;
  - a second anonymous GET of `/reports` is a cache hit, and a write purges it.
- **Review round** (`.claude/agents/orchestrator.md`):
  - `reviewer` on each diff;
  - `ux` on R3 and R4;
  - `copy-judge` on R4 and R5.
