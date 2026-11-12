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
  - the username and avatar the account holder picks;
  - each linked Google or Discord account: the account id, a display name, the email address, and the picture URL Google or Discord sent; the access and refresh tokens it returned, encrypted with a key derived from the site's secret; the ID token; their expiry and the granted scope;
  - each passkey: its public key and credential id, a label, the authenticator model (AAGUID), its type, whether it is backed up, its transports, a use counter, and when it was made. The private key stays on the reader's device. A new passkey is labelled with the browser and system it was made on, such as "Chrome on macOS", until the account holder renames it;
  - each session: a token, its expiry, the IP address and browser that started it.
- **Cookies:** `better-auth.session_token` identifies the session and lasts seven days. `better-auth.session_data` holds a signed copy of the session for five minutes, so a request within that time skips the session lookup. A passkey or Google or Discord sign-in sets one more short-lived cookie while it runs. None of these can be read by page scripts. On HTTPS each of these names starts with `__Secure-`. `midb_hint` is a separate cookie that page scripts set while a reader is signed in, for seven days. Its value is `1`: it holds no identity, the server does not read it, and the page only uses it to draw the account button before the account is known. Signing out removes it.
- **Bot check:** creating an account with a passkey can require a Cloudflare Turnstile check, which sees the reader's browser and IP address. Cloudflare's script loads from `challenges.cloudflare.com` only when a reader starts creating an account on the sign-in page, and only when a Turnstile site key is configured; no other page loads it.

The email address is shown only on the account's own profile page. Other readers see only the username and avatar. Signing out ends the session and clears the cookies. Better Auth's telemetry is off, so nothing about the site is sent to its authors.

## Ratings and comments

The database has tables for community ratings and comments, but the site has no way to submit them yet. When it does, this file will say what is stored and who can see it.

## Contact

Questions: [issues](https://github.com/Against-Misogyny-in-Movies/MIDB/issues). Security problems: report privately as [SECURITY.md](SECURITY.md) says.
