# Plan: MIDB community reports

Reader reports become MIDB community reports, moderators and administrators report without waits, holds or rate limits, the detail pages show a report count at the top, and the add, edit and delete flow is reworked. The phases are C1 to C4 in `docs/phases/STATUS.md`.

## Settled decisions

- **The name** (user instruction, 2026-11-13). The feature is "MIDB community reports" everywhere: copy, docs, code identifiers, file names and anchors.
  - Headings, the section title, the moderation tab, page titles and link labels read "MIDB community reports".
  - Running text says "community report" or "community reports", the short form of the same term. The term joins the one-term-per-concept list in `.claude/rules/copy-standards.md`.
  - The anchors become `#community-reports` on the title pages and on `/resources`.
- **Staff reports** (user instruction, 2026-11-13). A report by an account whose role is `moderator` or `administrator`:
  - counts at once, with no account-age wait;
  - is never held: no hold rule runs on it, so it is saved as `counted` with no hold reason (a rejected report still stays rejected);
  - is not rate-limited on `PUT` and `DELETE …/reports` and on `POST …/reports/flag`.
  - The mute and ban checks, the "I watched this" rule and the answer validation still apply. Comments keep every limit they have.
  - A staff report held before this change is re-decided on its next save.
- **The header badge** (user instruction, 2026-11-13). Both detail pages show, in the header beside the title, a badge with the number of counted community reports, the same total as the section's status, linking to the section.
- **The flow.** C4's changes come from the `ux` review of the flow; they change markup, copy and client state only, never the server, the data model, the counting rules or the verdict.

## Out of scope

- The database: the tables (`community_content_reports`, `title_count_flags`), their columns, the moderation-log action names and the rate-limit binding names keep their names. No migration.
- The counting threshold below which only the total shows (`READER_REPORT_MIN`, renamed in C1) is unchanged for everyone: the counts endpoint is public and cookie-blind.
- `docs/plans/done/`, which is history.

## C1: Rename to MIDB community reports

- **Copy.** Every user-facing "reader report(s)" and "Reader reports" follows the name decision: the title-page section, the counts, form, own-report and flag components, the moderation tab and its rows and confirmations, `/user/metrics`, the `/user/profile` link, the Methodology section on `/resources` and its table of contents, the error and notice strings in the client state.
- **Code.** Files, components, types, functions and constants named for reader reports take the community-report name, with their tests and every import:
  - `readerReport*.svelte` → `communityReport*.svelte`, `readerReportsPanel.svelte` → `communityReportsPanel.svelte`, `readerReportRows.spec.ts` and `readerReportsSection.spec.ts` likewise;
  - `reader-report*.ts` → `community-report*.ts` (server data and http modules, `src/__tests__/api-reader-reports.db.spec.ts`), `media/types/reader-reports.ts` → `community-reports.ts`;
  - `media/utils/readerReports.ts`, `readerReportsState.svelte.ts` and `db/lib/readerReports.ts` → `communityReports…`;
  - identifiers: `ReaderReports*` → `CommunityReports*`, `READER_REPORT_MIN` → `COMMUNITY_REPORT_MIN`, `PUBLIC_READER_REPORTS` → `PUBLIC_COMMUNITY_REPORTS`, `readerReportsTag` / `readerReportsHeaders` → `communityReports…`, `readerStandingLabel` stays (it names the reader, not the feature);
  - the purge log label `'reader-reports'` becomes `'community-reports'`; the `Cache-Tag` value (`reports:<kind>:<tmdbId>`) is unchanged.
  - Code comments say "community report".
- **Anchors.** `id="reader-reports"` and every link and hash check to it become `community-reports` (title pages, sign-in return path, `/resources`, the section's `learnHref`).
- **Docs.** `docs/architecture.md` (headings and file map), `DESIGN.md`, `PRODUCT.md`, `PRIVACY.md`, `SECURITY.md`, `README.md` if it names them, and the Open items and Standing decisions of `docs/phases/STATUS.md` (the orchestrator edits STATUS). Then `pnpm docs:index`.
- **Exit.** `grep -rni "reader.report\|readerreport\|reader_report" src db scripts e2e-tests docs/*.md *.md .claude` finds nothing outside `docs/plans/done/` and this plan.
- **Commit.** `feat:` with a `Breaking:` line: links to `#reader-reports` no longer open the section.

## C2: Staff reports count at once

- **Shared role list.** One exported staff role list and an `isStaff(role)` check in a client-safe module (`#lib/media/utils/`), used by the new code and by the existing `['moderator', 'administrator']` literals in `src/hooks.server.ts` and `src/routes/user/moderation/+page.server.ts`.
- **Holds.** `upsertReport` reads the author's role; for staff it skips `loadHoldFacts` and `holdReasonFor` and writes `counted` with a null hold reason. The rejected-stays-rejected `CASE` in the write is kept.
- **Counts.** `getReportCounts` counts a staff account's `counted` reports whatever the account's age; muted and banned accounts stay out.
- **Counts from.** `countsFromDate` takes the role and answers the account's creation time for staff, so every caller (`getViewerReport`, `user-queries.ts`, the moderation queue) shows a staff report as counted.
- **Rate limits.** `authorizeWrite` gains an option that skips the rate limit for staff, used only by the three community-report write endpoints. The guard and the mute check still run first.
- **Copy and docs.** The Methodology section states the exemption next to the account-age sentence, from the shared role list. `SECURITY.md` (community reports, rate limits) and `docs/architecture.md` state it.
- **Tests.** `*.db.spec.ts` cases: a young moderator's report is counted, never held under a burst or a UM contradiction, and in the counts; a young user's report still waits; a rejected staff report stays rejected on edit. Unit cases: the endpoints skip `rateLimit` for staff and still call it for a user; `isStaff`.

## C3: Report count badge in the header

- **Placement.** `DetailHeader` gets an optional snippet rendered in `.heading` under the meta line. Both detail pages pass a badge component there.
- **One request.** The page owns the title's community-reports state (recreated when the TMDB id changes) and passes it to both the badge and the section; the counts are requested once per title.
- **The badge.** A `Badge` (neutral tone) inside a link to `#community-reports`, reading "N community reports" ("1 community report") with `tabular-nums`. While loading, it keeps its size and has `aria-busy`; on an error it reads "MIDB community reports" with no number. It never blocks first paint and moves nothing when the count arrives.
- **Opening the section.** Following the link opens the section and scrolls to it: the section reacts to `hashchange` as well as to the hash on mount.
- **Docs.** `DESIGN.md` (detail header) and `docs/architecture.md` (the section and the header).
- **Tests.** Component specs: the badge's loading, number, singular and error states; the section opens on `hashchange`; the counts are fetched once.

## C4: Reporting flow

Not briefed until the `ux` review of the flow returns; its accepted items are written here before C4 starts.
