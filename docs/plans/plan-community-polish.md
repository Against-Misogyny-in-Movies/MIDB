# Plan: community polish

Staff powers, links to comments, faster votes, a closed Does the Dog Die section, public profiles and a Letterboxd score. The phases are rows S1–S6 in `docs/phases/STATUS.md`.

## Decisions

These are user decisions from 2026-11-13. The settled ones are also in `docs/phases/STATUS.md`, Standing decisions.

- **Comment links.** Every place that names a comment links to it on its title page: comment history, moderation, recent actions and public profiles.
- **Reporter names.** Comment reports show the reporter's username to staff.
- **Administrators.** An administrator may act on any account and any comment, their own and other administrators' included. The one exception is muting or banning themselves. Moderators keep their current limits.
- **Staff rate limits.** Moderators and administrators are not rate-limited, except on the AI moderation calls (`RL_MODERATE_AI`), which cost money.
- **Votes.** A vote shows at once. The voter sees current scores for the comments they voted on after a reload. Votes do not purge the list (user decision, 2026-11-13).
- **DDD.** The Does the Dog Die section renders closed.
- **Profiles.** Each account with a username has a public profile showing:
  - its avatar, name, join date and staff role;
  - its comment score total;
  - its published comments;
  - its counted community reports.
- **Letterboxd.** Film pages show the Letterboxd average rating, the only outside rating. It comes from the official Letterboxd API with a secret key. Without the key it is absent.

## Phases

### S1: Staff powers and rate limits

**Target checks**

- `targetAllowed` (`src/lib/server/data/moderation-target.ts`):
  - An administrator actor gets the target back with no role or self check, except when they mute or ban themselves.
  - Mute and ban pass the action so it can refuse that case.
  - Moderators keep today's rules.
- `resolveCountFlag` and `dismissCountFlag` (`count-flags.ts`) gain the same check, so a moderator cannot close their own flag.

**Client mirror**

- `canActOn` (`src/lib/media/utils/canActOn.ts`) mirrors the new rules.
- `moderationItem.svelte`, the moderation table and `communityReportsPanel.svelte` hide every control the server would refuse, not only Mute and Ban.
- The refusal message in `src/lib/server/http/moderation-action.ts` states the new rule.

**Rate limits**

- `authorizeWrite` (`src/lib/server/http/comment-request.ts`) skips the limit for staff on every write, so the `staffExempt` option goes.
- `act` (`moderation-action.ts`) skips it for every bucket except `RL_MODERATE_AI`.
- `/user/profile/availability` skips it for staff.
- Auth and search stay limited: they are keyed by IP before any user is known.

**Reporter names**

- `toModerationItems` (`moderation-queue.ts`) left-joins `users` on `commentReports.reporterId` and selects the reporter's username, following the count-flag query in `community-report-queue.ts`.
- `moderationItem.svelte` and the table's report list show the name.
- The page is staff-only and already `private, no-store`. `SECURITY.md` says staff see reporter names.

**Tests**

- DB specs for `moderation-target`, `count-flags` and `moderation-queue`:
  - an administrator acting on an administrator;
  - an administrator acting on themselves, refused only for mute and ban;
  - the reporter selected.
- Unit specs for `canActOn` and `comment-request`.

### S2: DDD section starts closed

- `dddMetricSection.svelte` passes `open={false}`. The badge still streams its status in place, and the section no longer collapses after loading.
- On a series, an episode switch no longer overrides the reader's own toggle.
- Update `DESIGN.md` and the component test.

### S3: Snappy comment votes

**Client: `vote()` in `src/lib/media/utils/commentsState.svelte.ts`**

- It applies the vote at once: the reader's vote, and the score by its delta.
- The vote buttons stay enabled while a request is out. Rapid clicks coalesce:
  - the latest intended value wins;
  - once the request in flight returns, one more request goes only if the final value differs;
  - the server's `{score, vote}` reconciles the shown values;
  - a failure rolls back to the last confirmed state and shows a toast.
- `commentItem.svelte` drops the busy `disabled` on the vote buttons and keeps `aria-pressed`.

**Server**

- The vote endpoint purges nothing (user decision, 2026-11-13): a purge per vote on a busy title spends the purge budget, and a refused purge for a moderation removal or new comment would go unseen.
- The viewer endpoint (`private, no-store`) also returns `scores`, the current score of each comment the reader voted on in this title, read with their votes. The client shows them over the cached list, on load and on later pages, and builds its optimistic deltas on them.
- Update `docs/architecture.md`, Caching policy, and the `PUBLIC_COMMENTS` comment in `cache.ts`.
- Measure the vote endpoint before and after with a scratch script on a local D1, and report both numbers in the commit body.

**Tests**

- Unit specs for the state: optimistic apply, coalescing and rollback.
- A DB spec that the viewer state returns scores only for the reader's voted comments on the title, and unit specs that the scores override the cached list's and seed the confirmed score.

### S4: Links to a comment

**URL and endpoint**

- `commentHref(kind, tmdbId, commentId)` in `src/lib/media/utils/titleHref.ts` returns `/<kind>/<tmdbId>#comment-<id>`.
- `GET /api/comments/[id]` returns the comment's thread (the root and its replies), from a new `getCommentThread` in `comment-queries.ts`:
  - A published comment goes to anyone.
  - Any other status goes only to its author or to staff.
  - The response is `private, no-store`, because it reads the user.
  - It is rate-limited by IP on a new `RL_COMMENT_READ` bucket: the binding in `wrangler.jsonc`, `RateLimitBucket` and the memory fallback.

**Client: `commentsSection.svelte`**

- A `#comment-<id>` hash, on load or on `hashchange`, opens the section. The hash handling follows `communityReportsSection.svelte`.
- If the comment is not in the loaded list, the section fetches its thread and pins it above the list, never duplicated when later pages load.
- It then scrolls to the comment, focuses it and highlights it briefly with `--brand-wash`. The motion is gated on `prefers-reduced-motion`.
- A comment that is not published carries its status badge.

**Links**

These link to `commentHref`:

- the comment history rows (`commentHistoryRow.svelte`);
- the moderation items and table;
- recent actions that name a comment;
- each comment's own date on the title page;
- public profiles (S5).

**Tests**

- A DB spec for `getCommentThread` visibility per role.
- Unit specs for `commentHref` and the hash handling.
- An e2e spec that opens a link to a comment on the second page.

### S5: Public user profiles

**Route and data**

- The route is `src/routes/u/[username]/`.
- A new `src/lib/server/data/profile-queries.ts` looks the username up case-insensitively. No match, a banned account and an account without a username are 404.
- The load returns a new `PublicProfile` type in `src/lib/media/types/`, never an email or a `UserRow`. It holds:
  - avatar, display name, staff role and join date;
  - the score total over published comments;
  - published comments, newest first, paged with "Load more", each linking to its title and to `commentHref`, with no moderation reason;
  - counted community reports by title.

**Caching**

- The page uses `PUBLIC_PAGE` with a `profile:<userId>` Cache-Tag and never calls `locals.getUser()`.
- These writes purge it:
  - a comment written, edited, deleted or moderated;
  - a username or avatar change;
  - a community report that counts or is rejected;
  - a ban.
- Votes do not purge it, so the score total trails by one TTL. `docs/architecture.md`, Caching policy, says so.

**Links**

- Comment author names (and "In reply to") link to the profile, and so do author and reporter names in moderation.
- `/user/profile` links to the reader's own public profile.

**Docs**

- `PRIVACY.md` and `SECURITY.md`: an account's comments and reports are now listed together in public.
- `PRODUCT.md`: the new route.
- `DESIGN.md`: the profile layout.
- `docs/architecture.md`: the file map, and the display-name passage, which today says the name reaches only the account holder.

**Tests and review**

- DB specs for the profile query (visibility, ban, case-insensitive lookup, score total) and for the purges.
- `ux` reviews the page through Impeccable.

### S6: Letterboxd score

**Integration**

- `src/lib/server/integrations/letterboxd.ts` calls the official API.
  - It looks a film up by TMDB id and reads its average rating and rating count.
  - It signs requests with `LETTERBOXD_API_KEY` and `LETTERBOXD_API_SECRET`. Those are Worker secrets read through `src/lib/server/env.ts`.
  - Without the keys, or on an error or timeout, it returns `null`.
- Types are in `integrations/letterboxd-types.ts`, re-exported from `src/lib/media/types/letterboxd.ts`.
- `loadTitle` streams the rating un-awaited, like DDD, for films only. Answers are cached at the edge for a day.

**UI**

- The film header shows the rating in a fixed slot that streams in place, and links to the film on Letterboxd.
- The slot is not rendered when no key is configured: the load passes that as a boolean.
- Letterboxd gets a source shade (`--src-letterboxd`) and icon per `DESIGN.md`, Colour. `ux` reviews it.

**Copy and docs**

- Methodology (`/resources`) lists Letterboxd as a source that does not affect the verdict. `copy-judge` checks it.
- `PRIVACY.md` and `SECURITY.md`: the new server request to Letterboxd, carrying the TMDB id only.
- `README.md` (Deploying a copy) and the deploy workflow's secrets list name the two keys.
- `docs/phases/STATUS.md` gains an Open item: test the integration once a key exists.

**Tests**

- Unit specs for the client against a mocked `fetch`: the signature, the lookup, the null cases and no key.
- A component spec for the slot.

## Order and review

- Order: S1, S2, S3, S4, S5, S6. S5 uses S4's `commentHref` and links the reporter names from S1.
- Each phase runs through `orchestrator`: `implementer`, then `reviewer`.
- `ux` runs when `src/routes` or `src/lib/components` changed, and `copy-judge` on S4–S6.
- Commit types:

  | Phase | Type    |
  | ----- | ------- |
  | S1    | `feat`  |
  | S2    | `style` |
  | S3    | `fix`   |
  | S4    | `feat`  |
  | S5    | `feat`  |
  | S6    | `feat`  |

## Verification

- Each phase runs the baseline (`.claude/rules/code-standards.md`, Checking a change).
- Then, on `pnpm preview` with seeded data, Playwright checks:
  - a moderation link to a comment on the second page;
  - rapid vote clicks persisting after a reload;
  - the DDD section closed with no layout shift;
  - a profile that renders, and a banned account's profile returning 404;
  - an administrator's controls on their own comment.
