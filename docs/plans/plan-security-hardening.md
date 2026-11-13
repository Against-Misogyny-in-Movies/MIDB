# Plan: security hardening

The fixes from the security audit of 2026-11-13 (user instruction, 2026-11-13: fix every finding). The site's subject makes it a target for organised harassment, so the work closes the cheapest attacks first: a person's moderation decision that does not stick, and sock-puppet accounts that hide or bury comments. Four phases, run in order, each by one Sonnet implementer; one review round at the end (`.claude/agents/orchestrator.md`).

## Kept as they are

These findings meet a standing decision in `docs/phases/STATUS.md`, so they are not changed: the public staff role and an author's stable id on comments, the counted community reports on public profiles, staff not being rate-limited outside the AI calls, administrators acting on their own comments, the rate limiter failing open, and the five-minute session cookie cache.

## Phase SH1: moderation decisions stick

1. **Edits after a person or reader reports decided.** In `editComment` (`src/lib/server/data/comment-queries.ts`):
   - A `rejected` comment whose `moderationSource` is `moderator` is not editable (`not-editable`, like `hidden` and `deleted`). A comment rejected by `ai` or `blocklist` stays editable, so an author can fix it.
   - A `pending` comment whose source is `moderator` or `reports` stays editable, but the edit never publishes it: when `decideStatus` answers `published`, the comment stays `pending` with its source and reason kept. A blocklist or AI reject still rejects it.
2. **A moderator publishes only the text they saw.** Every action that makes a comment public (approve, restore, dismiss reports, and the same operations in `?/bulk`) carries the comment's `editedAt` as the moderator's view loaded it, and refuses with the existing `invalid-state` answer when the stored `editedAt` differs. The check is a condition in the same batch as the status change (`statusMove` in `comment-status.ts`, `logCommentAction`, `stillIn`), so a concurrent edit cannot slip between check and write. Actions that hide or reject need no version. The moderation UI sends the value from the row it shows, and its toast on `invalid-state` already asks to reload.
3. **The AI publishes only a clean answer.** In `applyPolicy` (`src/lib/server/moderation/policy.ts`), `allow` publishes only with `severity` 0 and an empty `categories`; any other `allow` waits for a person (`pending`, source `ai`).
4. **An administrator's decision binds a moderator.**
   - A moderator's mute never shortens an active mute: the stored `mutedUntil` becomes the later of the two. An administrator may set any length.
   - A moderator may not approve, restore or dismiss the reports on a comment whose latest logged moderation action (`moderationActions`) was taken by an administrator; the action answers the existing refusal for a target the actor may not act on.
   - A moderator may not close a "Counts look wrong" flag raised by an administrator (`canCloseFlag`, `count-flags.ts`).
5. **Blocklist variants.** In `src/lib/server/moderation/blocklist.ts`, before matching: remove every `\p{Cf}` character and the variation selectors (U+FE00–FE0F), and fold Cyrillic and Greek letters that look like Latin ones to their Latin letter (a small table in the same file). A term also matches with a trailing `s` or `es`. Splitting a word with spaces is left to the classifier.
6. **The scan cannot address its neighbours.** In `src/lib/server/moderation/scan.ts`, each item in a batch is labelled with a random token made per call (not a sequential `n`), and answers are matched back by token, so one comment's text cannot name another item's label.
7. **Edit and delete do not reveal a comment.** `editComment` and `softDeleteComment` answer `not-found` (404) to anyone but the author, whatever the comment's status.

Tests: each rule above, in the existing `*.db.spec.ts` and unit specs of the files it changes. Docs: `SECURITY.md` (Comments, Moderation table) and `docs/architecture.md` sections on comments and moderation.

## Phase SH2: sock puppets and brigades

1. **Reports that hide a comment.** The `REPORT_THRESHOLD` count in `reportComment` (`src/lib/server/data/comment-reports.ts`) counts only open reports from reporters who are staff, or at least `REPORT_ACCOUNT_MIN_AGE_DAYS` old and neither muted nor banned: the rule of `countedReportsWhere` (`community-reports.ts`), reused, not copied. Other reports are still stored and shown to staff.
2. **Votes need the same account age.** `setVote` refuses an account younger than `REPORT_ACCOUNT_MIN_AGE_DAYS` (staff exempt) with 403 and a message the vote control shows: "Votes open once an account is N days old." with N from the constant. Removing a vote is always allowed.
3. **A ban takes the account's weight away.** `banAccount` (`moderation-actions.ts`), in the same batch as the ban and its log row:
   - deletes the account's comment votes and recomputes the score of every comment it had voted on (`chunkForD1` for the id lists);
   - moves the account's `published` and `pending` comments to `hidden` with source `moderator` and reason "Account banned".

   It then purges the lists of the titles those comments were on and the profiles of the authors whose scores changed.

4. **Bursts from fresh accounts.** `isBurst` (`community-report-holds.ts`) counts only other reports from accounts that pass the counting rule in step 1, so new accounts cannot hold a title's honest reports. Re-checking a burst hold after its window passes is not built (an Open item).

Tests: each rule, in `*.db.spec.ts`. Docs: `SECURITY.md` (Comments, MIDB community reports), `docs/architecture.md`, and `/resources` Methodology if it describes reports or votes (`copy-standards.md`).

## Phase SH3: accounts

1. **Usernames are checked like comments.** `updateProfile` (`src/lib/server/data/user-queries.ts`) refuses:
   - a name the comment blocklist matches, reading `_` as a word break (`username-blocked`);
   - a name that contains `admin`, `moderator` or `midb`, or has a `_`-separated part in `RESERVED` (`username-reserved`);
   - any change while the account is muted (`muted`).
2. **Renames are rate-limited and names are not recycled.**
   - The `updateProfile` action is rate-limited per user on a new `RL_PROFILE` bucket (10 a minute), added to `wrangler.jsonc` in both environments, `RateLimitBucket` and its fallback. Staff skip it (standing decision).
   - A username can change once every 30 days, staff exempt; the first change after sign-up is free. New nullable column `users.username_changed_at` (`timestamp_ms`).
   - The old name goes into a new table `retired_usernames` (`username` primary key, `user_id` foreign key on delete cascade, `retired_at`). For 90 days it is taken for everyone but its former owner; `isUsernameAvailable` and `updateProfile` both read it.
   - One generated migration (`pnpm db:generate`), additive only.
   - The profile form shows each new refusal as it shows the existing ones.
3. **Sign-up without Turnstile is refused outside localhost.** `guardPasskeySignUp` (`src/lib/server/auth/turnstile.ts`): with no `TURNSTILE_SECRET_KEY` and a non-local origin (`isLocalOrigin`), a passkey sign-up fails with `UNKNOWN_ERROR` and logs that the secret is missing. In `wrangler.jsonc`, the comment above `PUBLIC_TURNSTILE_SITE_KEY` says it is the widget's public site key; the value is not changed.

Tests: each rule. Docs: `SECURITY.md` (Sign-in methods), `PRIVACY.md` for the retired names it now stores, `docs/architecture.md` (schema, auth).

## Phase SH4: platform

1. **Security headers.** The request hook (`src/hooks.server.ts`) sets on every response it returns: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()` and `Cross-Origin-Opener-Policy: same-origin`.
2. **Content Security Policy.** SvelteKit's `csp` option in `vite.config.ts`, mode `hash` (title pages are edge-cached, so a nonce would be reused). Directives:
   - `default-src 'self'`, `script-src 'self' https://challenges.cloudflare.com`, `frame-src https://challenges.cloudflare.com`, `connect-src 'self'`;
   - `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`, `font-src 'self'`;
   - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.

   The inline script in `src/app.html` moves to a file in `static/`, loaded by a blocking `<script src>` in the head, so it keeps running before first paint. Check in the built Worker (`pnpm preview` with Playwright) that `/`, `/auth`, `/resources` and a profile log no CSP violation and that the theme still applies before paint. If a needed source is missing from the list, STOP and report it rather than widening the policy.

3. **Title ids.** `loadTitle` (`src/lib/server/titles/load-title.ts`) answers 404 for an id that is not 1–9 digits, before any TMDB, DDD or Letterboxd request, the rule `parseTitleParams` uses.
4. **Public timestamps to the minute.** Comment `createdAt` and `editedAt` in public responses (a title's list, `/api/comments/[id]` for comments not the reader's own, profile comments) are rounded down to the minute. The author's own and staff views keep the exact time. The pagination cursor is not changed.
5. **Dependencies.** Move postcss, vite, vitest and esbuild in the lockfile to patched versions (`pnpm update` within the ranges, or `pnpm.overrides` for a transitive copy) so `pnpm audit --prod` reports nothing but the unpatched `deepmerge`.

Docs: `SECURITY.md` (Network, Supply chain) and `docs/architecture.md` (request hook).
