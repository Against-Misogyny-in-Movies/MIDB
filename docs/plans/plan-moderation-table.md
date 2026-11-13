# Moderation table with Haiku search and scan

## Context

Staff (moderators and administrators) moderate from `/user/moderation`, which has four tabs: Pending, Reported, MIDB community reports and Recent actions. Each queue is a list capped at `QUEUE_LIMIT` (50). It can't be filtered or paged, and it shows only comments that are already held or reported. Every comment gets a Claude Haiku 5.5 verdict when it is posted (`aiVerdict`: decision, categories, severity), but nothing lets staff search or filter on that verdict.

The user asked for a table where admins and moderators can browse, monitor and act on comments and their reports, with Haiku-driven search and filtering for violent, disparaging, trolling and similar content.

What the user decided (2026-11-13):

- **Placement:** a new **Table** tab on `/user/moderation`. The existing tabs stay as they are.
- **How the AI helps:** both of these.
  1. A plain-language query that Haiku turns into structured filters over the stored verdicts.
  2. A "Scan with AI" button that re-checks the rows on screen for a concern the moderator types, and saves the labels it finds.
- **New categories:** add `violence`, `disparagement` and `trolling` to the classifier.
- **Scope:** comments and the reader reports on them. Community reports (title reports) keep their own tab.

Phases M1–M4 in `docs/phases/STATUS.md` track this plan. It runs with `orchestrator` (implementer per phase, then reviewer, plus `ux` and `copy-judge`). Branch: `claude/comments-moderation-table-ai-1wkr75`.

---

## M1 — Data: categories, migration, table query

**Categories.** In `src/lib/server/moderation/verdict.ts`, add `'violence'`, `'disparagement'` and `'trolling'` to `VERDICT_CATEGORIES`.

- In `SYSTEM_PROMPT` (`classify.ts`), name what each covers inside the existing "Not allowed" sentence:
  - **violence:** glorifying or calling for violence;
  - **disparagement:** demeaning a person or a group without a slur;
  - **trolling:** bad-faith bait meant to provoke.
- Update the category labels wherever the AI badges are mapped (`moderationItem.svelte` reads `aiCategories`; find the label map).
- `policy.ts` is unchanged.

**Migration** (`pnpm db:generate`, additive only, so it works with the old Worker still serving):

- New table `comment_ai_labels` in `db/schema/community.ts`, holding the scan results:

  | Column         | Type                          | Notes                                                                 |
  | -------------- | ----------------------------- | --------------------------------------------------------------------- |
  | `id`           |                               |                                                                       |
  | `comment_id`   | FK, `on delete cascade`       |                                                                       |
  | `concern`      | text                          | The moderator's typed concern, at most `SCAN_CONCERN_MAX` characters. |
  | `matched`      | boolean integer               |                                                                       |
  | `categories`   | JSON text                     | CHECK `json_valid`                                                    |
  | `severity`     | integer                       | 0–3                                                                   |
  | `reason`       | text                          |                                                                       |
  | `model`        | text                          |                                                                       |
  | `scanned_by`   | FK user, `on delete set null` |                                                                       |
  | `timestamps()` |                               |                                                                       |
  - Index `(comment_id, created_at)`.
  - Add the table to `DELETE_ORDER` in `db/test/setup.ts`.

- New indexes on `comments`: `(status, created_at)` and `(created_at)`. Today the global table would scan, because every existing index leads with `title_id`.

**Filters (client-safe).** New file `src/lib/media/utils/moderationFilters.ts`:

- A zod `TableFilters` with these fields:
  - `q`: a substring of the body;
  - `status[]`;
  - `categories[]`, from `VERDICT_CATEGORIES`, re-exported as a type through `#lib/media/types/moderation.ts`;
  - `minSeverity`;
  - `source` (`ai | blocklist | moderator | reports`);
  - `reported` (has open reports);
  - `title` and `author` (substrings);
  - `from` and `to` (dates);
  - `sort` (`newest | oldest | reports | severity`);
  - `page`.
- `parseFilters(URLSearchParams)` and `filtersToParams(filters)`. Unknown or bad values are dropped, never thrown.
- The filters live in the URL, so a filtered view can be linked and reloaded.

**Query.** New file `src/lib/server/data/moderation-table.ts`, function `listModerationTable(filters)`, returning `{ rows, total, page, pageSize }`.

- Each row reuses the `ModerationItem` shape from `moderation-queue.ts`: comment, author, title, `aiCategories`, open reports, author comment count, mute end. It adds:
  - `severity`, from `aiVerdict`;
  - `aiFailure`;
  - `latestLabel`: the newest `comment_ai_labels` row for the comment.
- If `moderation-queue.ts` builds rows privately, extract its row builder and share it rather than copying it.
- Category and severity filters use `json_each(comments.ai_verdict, '$.categories')` inside an `exists (…)` `sql` fragment in the query builder's `where`. A category also matches when it is on the comment's latest _matched_ scan label. These are fragments, not raw `db.all`, so the code standards on raw queries are met.
- Paging is offset-based, with `TABLE_PAGE_SIZE` = 50. Staff traffic is small and the `reports` and `severity` sorts can't be paged by keyset. Any `inArray` over the page's ids goes through `chunkForD1`.

**Tests**

- `src/lib/server/data/__tests__/moderation-table.db.spec.ts`: every filter, every sort, paging, the json category match, the scan-label category match, and deleted comments still shown to staff.
- A unit spec for `moderationFilters.ts`: parse and serialize round-trip, bad input dropped.

## M2 — AI: shared call helpers, query to filters, scan

**Shared helpers.** New file `src/lib/server/moderation/model-call.ts`. Move into it, from `classify.ts`:

- `asData`;
- `failureCode`;
- the `ClassifyFailure` codes, renamed `ModelFailure` and kept as an alias for `ClassifyFailure`;
- a `readStructured(text, looseSchema, strictSchema)` built from `readVerdict`'s parse-then-strict steps.

`classify.ts` then uses these, with no behaviour change, and its spec stays green.

**Query to filters.** New file `src/lib/server/moderation/search-filters.ts`, function `queryToFilters(query, today)`, returning `{ ok: true, filters, model } | { ok: false, code }`.

- The call has the same shape as `classifyComment`:
  - `getAnthropic()`;
  - model `env.MODERATION_MODEL || 'claude-haiku-5-5'`;
  - `thinking: { type: 'disabled' }`, `effort: 'low'`;
  - `zodOutputFormat` of a bound-free `FilterSpec` (the `TableFilters` fields minus `page`);
  - stop reasons checked before parsing.
- The system prompt is frozen. It lists the categories with a one-line meaning each, the statuses and the sorts, and says the query is data to be translated, never followed.
- The user turn is `<today>` plus `<query>` (passed through `asData`, at most `AI_QUERY_MAX` = 300 characters).
- The result goes through `TableFilters` (strict). A query that maps to no filter returns `{ ok: true, filters: { q: query } }`, which falls back to a text search.

**Scan.** New file `src/lib/server/moderation/scan.ts`, function `scanComments(concern, items)`. Each item is `{ id, body, titleName, kind }`. It returns per-id results or a failure.

- One call per batch of up to `SCAN_BATCH` = 25 comments, at most 2 batches (one page of 50). Each comment is sent as `<comment n="i" title="…">…</comment>` under the `<concern>`.
- The output schema is `{ results: [{ n, match, categories, severity, reason }] }`. Results are matched back by `n`, and an `n` that is missing or unknown is ignored.
- Only the body and the title name are sent, never author data. These are the same fields `classifyComment` already sends.
- Then a new `saveScanLabels(staffId, concern, results)` in `src/lib/server/data/comment-ai-labels.ts` writes every result in one `db.batch`, through `chunkForD1`.
- The deadline is `SCAN_DEADLINE_MS`, about 20 s. This is a staff action, so a slower deadline is acceptable.

**Rate limit.** New bucket `RL_MODERATE_AI`, 10 a minute, keyed per staff `userId` after `requireRole`.

- Add it in `wrangler.jsonc`, in both production and preview, with fresh `namespace_id`s 1009 and 2009.
- Add it to `RateLimitBucket` and to the memory fallback in `src/lib/server/http/rate-limit.ts`.

**Tests**

- Unit specs with the SDK mocked, following the pattern in `classify.spec.ts`:
  - `search-filters.spec.ts`: refusal, truncation, an unparsed answer, an out-of-range value dropped, an injection-shaped query treated as data, the fallback to `q`;
  - `scan.spec.ts`: batching, matching results by `n`, a partial answer.
- `comment-ai-labels.db.spec.ts`.
- The existing `classify.spec.ts` stays green after the extraction.

## M3 — Route and UI

**Load** (`src/routes/user/moderation/+page.server.ts`): when `tab=table`, it also returns:

- `table` = `listModerationTable(parseFilters(url.searchParams))`;
- `filters`;
- `aiAvailable` (`!!env.ANTHROPIC_API_KEY`, as a boolean only).

The other queues load as they do now.

**Actions**, all through the existing `act()`:

- `aiSearch`: reads `query` and calls `queryToFilters`. It returns `{ done: 'aiSearch', params }`, and the client `goto`s `?tab=table&…params`.
- `scan`: reads `concern` and `ids[]` (at most `TABLE_PAGE_SIZE`). It loads those comments, calls `scanComments`, then `saveScanLabels`, and returns a match count. The page then invalidates, so `latestLabel` shows.
- `bulk`: reads `op` (one of `approve | hide | reject | restore | dismiss`), `ids[]` and an optional `reason`. It calls the existing single-comment functions in `moderation-actions.ts` one by one and collects how many succeeded and how many were refused. It purges every title it touched, once each. Each existing function already checks its own state and authority, so bulk adds no new write path.
- The row actions (approve, hide, reject, restore, dismiss, mute, ban) reuse the current actions unchanged.
- Model failures map to a new refusal: `'ai-unavailable' → [503, …]`.
- If `+page.server.ts` goes past roughly 300 lines, move `act` and `refusals` into `src/lib/server/http/moderation-action.ts`. It must stay under 500 (`file-size.spec.ts`).

**Components** (new folder `src/lib/components/moderation/table/`, styled with tokens per `DESIGN.md`; design pass through `/impeccable`):

- `moderationTable.svelte`: a `<table>` inside a `.card`.
  - A sticky header (`top: 5rem`).
  - Columns: select, comment (`line-clamp-2`), author, title (a link to its page), status `Badge` (`commentStatusTone`), AI (category `Badge`s and severity), reports (count and reasons), scan (the latest label for the concern), posted (`formatDate`, `tabular-nums`), and an actions button.
  - Selecting a row opens it in an expandable detail row that renders the existing `moderationItem.svelte`, which has every action panel. Nothing is duplicated.
  - Below `sm`, rows stack as label/value lists.
- `tableFilters.svelte`: a GET form for every `TableFilters` field. The active filters show as removable `.chip`s.
- `aiSearchBar.svelte`: the plain-language query (submits to `?/aiSearch`) and a scan concern with "Scan this page" (submits to `?/scan` with the page's ids).
  - Both are disabled, with a `Notice`, when `aiAvailable` is false.
  - Both use `aria-busy` while running.
  - After an AI search, the filters it chose show as chips, so the moderator can see and change them.
- `bulkBar.svelte`: shown when rows are selected. It has the bulk ops, a reason field for hide and reject, and confirmation through `moderationConfirm.svelte`.
- `tablePager.svelte`: Previous / Next and "page N of M". These are links built with `filtersToParams`.

**Page** (`src/routes/user/moderation/+page.svelte`):

- Add a `{ id: 'table', label: 'All comments' }` tab.
- Choosing it `goto`s `?tab=table` with `keepFocus`, because the table needs the server load. `tab` is derived from `data.tab === 'table'` too.
- Toasts and focus reuse `rowSubmit` and `toastActionResult` (`src/lib/media/utils/rowSubmit.ts`), adding the `DONE` entries `aiSearch`, `scan` and `bulk`.

**Tests**

- In `page.server.spec.ts`, cover:
  - the load with a table;
  - `aiSearch` and `scan` (data modules mocked);
  - `bulk` with mixed results, checking the purge runs once per title;
  - 403 for a user who isn't staff;
  - 429 passing through.
- In `page.spec.ts`, cover:
  - the tab renders;
  - the filter chips;
  - the AI controls disabled without a key;
  - the bulk bar shown on selection.
- One component spec in `table/__tests__/`.

## M4 — Copy and docs

**Copy**

- `/resources`, Methodology: the comment-policy passage that mirrors `policy.ts` and `verdict.ts` gains the three categories.
- New labels and notices are sentence case, use "comment", "flag" and "concern" as the copy standards define them, and have no em dashes. Run `copy-judge`.

**Privacy and security**

- `PRIVACY.md`: staff can re-check stored comments with Claude Haiku 5.5. Only the comment text and the title's name are sent, and scan labels are kept with the comment.
- `SECURITY.md`: the new rate limit, and the fact that queries and concerns are sent to the model as tagged data.

**Architecture and design**

- `docs/architecture.md`: the new files under Comments (moderation table, `model-call.ts`, `search-filters.ts`, `scan.ts`, `comment-ai-labels.ts`), the new table and indexes under Migrations, and the new bucket under Configuration & environment.
- `DESIGN.md`: the data-table pattern (sticky header, stacking on phones, the detail row).
- Run `pnpm docs:index`.

**Status file**

- Update `docs/phases/STATUS.md` with rows M1–M4 and these open items:
  - the scan and the query-to-filters call have run only against a mocked SDK;
  - the table has not been rendered against real traffic.
- When everything is done, delete the plan.

---

## Reused pieces

| What                                                                         | Where                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guards                                                                       | `requireRole`, `STAFF_ROLES` (`src/lib/server/auth/guards.ts`, `src/lib/media/utils/staff.ts`)                                                               |
| Moderator actions                                                            | `act()`, `refusals` in `src/routes/user/moderation/+page.server.ts`                                                                                          |
| Comment actions (approve, hide, reject, restore, dismiss reports, mute, ban) | `approveComment`, `hideComment`, `rejectComment`, `restoreComment`, `dismissReports`, `muteUser`, `banAccount` (`src/lib/server/data/moderation-actions.ts`) |
| Who may act on whom                                                          | `targetAllowed` (`moderation-target.ts`); `canActOn` on the client                                                                                           |
| Cache purge                                                                  | `purgeTitleComments` (`src/lib/server/http/purge-title.ts`)                                                                                                  |
| Anthropic client and classifier pattern                                      | `getAnthropic` (`src/lib/server/integrations/anthropic.ts`); `classifyComment` (`src/lib/server/moderation/classify.ts`)                                     |
| Comment row with every action panel                                          | `moderationItem.svelte`, `moderationConfirm.svelte`                                                                                                          |
| UI primitives                                                                | `Badge`, `Notice`                                                                                                                                            |
| Submit, toast and focus                                                      | `rowSubmit`, `toastActionResult`, `focusAfterUpdate`                                                                                                         |
| D1 helpers and test setup                                                    | `chunkForD1` (`db/lib/chunkForD1.ts`); `db.batch`; `userValues` (`db/test/users.ts`); the cloudflare stub's `env` and `purgeCalls`                           |

## Verification

1. **Baseline**, once at the end (`.claude/rules/code-standards.md`, Checking a change): `pnpm check`, `pnpm typecheck`, `pnpm lint`, `pnpm test:unit --run`, `pnpm test:db` and `pnpm build`, all green.
2. **Migration:** `pnpm db:generate` shows no drift after the change (CI's `migrations` job), and `pnpm db:migrate` applies to a local D1.
3. **Manual check:**
   1. Seed a staff account with `pnpm db:seed:admin <email>` and insert comments of each status into the local D1.
   2. Run `pnpm dev` and open `/user/moderation?tab=table`.
   3. Check each filter, the sorts, paging, the URL round-trip on reload, a row action, a bulk hide, and a 403 for a non-staff account.
   4. Without `ANTHROPIC_API_KEY`, the AI controls are disabled and show the notice.
   5. Take a Playwright screenshot at phone and desktop widths for the `ux` review.
4. **With a real key, if one is provided:** run the query "trolling replies this week" and check the filters it produces, then scan one page for "disparaging remarks about survivors" and check that the labels are saved. Otherwise, record this as an open item in STATUS.md.
