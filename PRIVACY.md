# Privacy

MIDB has no trackers, analytics or advertising, and sells or shares no data. This file says what the site stores and sends today. It changes in the same commit as any change to what the code stores or sends (`.claude/rules/code-standards.md`, Making a change).

## Reading the site

A reader who does not sign in gives MIDB no personal data.

- **The browser stores** one value: the chosen theme, in `localStorage` (`theme`). It never leaves the browser.
- **Third-party requests** from the browser: none. Posters load from MIDB's own `/img/tmdb/` path, and the Inter Tight font is served from MIDB.
- **MIDB's own server** looks up each page's data on TMDB and Does the Dog Die, and fetches each poster from `image.tmdb.org` (TMDB). These requests carry the title or file being looked up, never anything about the reader, so TMDB sees MIDB's server and not the reader's IP address or browser.
- **Hosting.** The site runs on Cloudflare Workers, which keeps standard request logs (IP address, URL, time) under its own policy. MIDB's database is Cloudflare D1, so the account data listed under Signing in is stored by Cloudflare. D1 Time Travel keeps the database's history for the window Cloudflare sets (30 days on the paid plan, per Cloudflare's D1 documentation), so a deleted account stays recoverable from that history for that long. The server also caches what it fetches from TMDB, Does the Dog Die and its database, search results, public pages and posters, in Cloudflare's cache. These hold film data and search text, never a reader's IP address, cookie or account.
- **Source sync.** A scheduled job, not a page visit, reads public data from unconsentingmedia.org (the Unconsenting Media list), bechdeltest.com (year pages and the feed of recent additions) files.tmdb.org (TMDB's daily id exports) and api.themoviedb.org (TMDB id lookups by IMDb id, with MIDB's TMDB API token). These requests send no reader data, only the `MIDB-sync` User-Agent, which names the project's repository, and the token on the TMDB lookups.
- **Rate limiting.** The rate limiter sends a key to Cloudflare's rate-limit service and counts it for the window set in `wrangler.jsonc`: the reader's IP address for search and sign-in, or the account id for the username check.

## Signing in

Accounts are handled by MIDB itself with Better Auth, which runs inside MIDB's Worker and database. There are no passwords.

- **Sign-in methods:** a passkey, or a Google or Discord account where the site offers them. Google or Discord receive a sign-in request when that method is used, and tell MIDB the account's name, email address and picture.
- **MIDB's own database** (Cloudflare D1) stores, for each account:
  - the account id, a display name, and the email address (a passkey-only account has a placeholder address under `users.invalid` that is never shown or used);
  - the role (user, moderator or administrator) and any ban or mute;
  - the username and avatar the account holder picks (a new account starts with a generated username, a feminist figure's name and four digits, which the account holder can change);
  - each linked Google or Discord account: the account id, a display name, the email address, and the picture URL Google or Discord sent; the access and refresh tokens it returned, encrypted with a key derived from the site's secret; the ID token; their expiry and the granted scope;
  - each passkey: its public key and credential id, a label, the authenticator model (AAGUID), its type, whether it is backed up, its transports, a use counter, and when it was made. The private key stays on the reader's device. A new passkey is labelled with the browser and system it was made on, such as "Chrome on macOS", until the account holder renames it;
  - each session: a token, its expiry, the IP address and browser that started it.
- **Cookies:** `better-auth.session_token` identifies the session and lasts seven days. `better-auth.session_data` holds a signed copy of the session for five minutes, so a request within that time skips the session lookup. A passkey or Google or Discord sign-in sets one more short-lived cookie while it runs. None of these can be read by page scripts. On HTTPS each of these names starts with `__Secure-`. `midb_hint` is a separate cookie that page scripts set while a reader is signed in, for seven days. Its value is `1`: it holds no identity, the server does not read it, and the page only uses it to draw the account button before the account is known. Signing out removes it.
- **Bot check:** creating an account with a passkey can require a Cloudflare Turnstile check, which sees the reader's browser and IP address. Cloudflare's script loads from `challenges.cloudflare.com` only when a reader starts creating an account on the sign-in page, and only when a Turnstile site key is configured; no other page loads it.

The email address is shown only on the account's own profile page. Other readers see only the username and avatar. The username, generated or chosen, is public on the account's comments. Signing out ends the session and clears the cookies. Better Auth's telemetry is off, so nothing about the site is sent to its authors.

## Ratings and comments

Community ratings are not submitted yet. Comments are, through the site's own endpoints, by a signed-in account that is not muted or banned.

- **What MIDB stores for a comment:** its text, the account that wrote it, the film or series it is on, the comment it answers if it is a reply, when it was written and last edited, its status (awaiting review, published, hidden, rejected or deleted), and the reason for a hide or a rejection, or why the site's checks gave it that status. Editing replaces the text; the earlier text is not kept. Deleting a comment marks it deleted and keeps its row and its text, with no time limit, so replies stay in their thread. Other readers no longer see the text. The author still sees it on the comment history page, and moderators see it in the action log.
- **Automatic check:** a new or edited comment is checked before it is stored with a status. The site sends Anthropic (the Claude API) the comment text, the title's name and, for a reply, the text of the comment it answers. It does not send the email, the username or any account id. Anthropic processes it under its own terms. MIDB stores the verdict beside the comment (the decision, categories, severity, a reason of at most `MODERATION_REASON_MAX` characters, the model's name), or the code of a failed check, and nothing else of Anthropic's answer. Without an `ANTHROPIC_API_KEY` nothing is sent: a comment the blocklist matches is rejected and every other comment waits for a moderator.
- **Votes and reports:** each up or down vote is stored with the account and the comment, so a vote can be changed or removed. A report stores the account, the comment, a reason and an optional note. Enough open reports from different accounts (`REPORT_THRESHOLD` in `src/lib/media/utils/comments.ts`) send a published comment back to review.
- **Moderation log:** each moderator action (approve, hide, reject, restore, dismiss, mute, ban) is stored with the moderator, the comment or account it applied to, a reason, the length of a mute and the time. It stays after what it applied to is removed.
- **Who sees what:** everyone sees the published comments of a title, with the author's username and avatar and the comment's score; a comment that is not published is not shown, though a placeholder with no text and no author stays where it has published replies. The author sees their own comments in every status, and the reason for a rejection. Moderators see the queue (each comment with its author's username and avatar, how many comments the account has written, when the author's mute ends, and the open reports on it with their reasons and notes, but not who reported) and the log. Reports and votes are not shown to other readers.
- **Caching:** the published list of a title is kept by Cloudflare's cache for a short time and cleared when someone comments, edits or deletes, or a moderator acts (`src/lib/server/http/cache.ts` holds the times). Scores can lag by that time. The list carries nothing about the reader who requests it.

## Contact

Questions: [issues](https://github.com/Against-Misogyny-in-Movies/MIDB/issues). Security problems: report privately as [SECURITY.md](SECURITY.md) says.
