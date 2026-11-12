# Privacy

MIDB has no trackers, analytics or advertising, and sells or shares no data. This file says what the site stores and sends today. It changes in the same commit as any change to what the code stores or sends (`.claude/rules/code-standards.md`, Making a change).

## Reading the site

A reader who does not sign in gives MIDB no personal data.

- **The browser stores** one value: the chosen theme, in `localStorage` (`theme`). It never leaves the browser.
- **Third-party requests** from the browser: none. Posters load from MIDB's own `/img/tmdb/` path, and the Inter Tight font is served from MIDB.
- **MIDB's own server** looks up each page's data on TMDB and Does the Dog Die, and fetches each poster from `image.tmdb.org` (TMDB). These requests carry the title or file being looked up, never anything about the reader, so TMDB sees MIDB's server and not the reader's IP address or browser.
- **Hosting.** The site runs on Cloudflare Workers, which keeps standard request logs (IP address, URL, time) under its own policy. MIDB's database is Cloudflare D1, so the account data listed under Signing in is stored by Cloudflare. D1 Time Travel keeps the database's history for the window Cloudflare sets (30 days on the paid plan, per Cloudflare's D1 documentation), so a deleted account stays recoverable from that history for that long. The server also caches what it fetches from TMDB, Does the Dog Die and its database, search results, public pages and posters, in Cloudflare's cache. These hold film data and search text, never a reader's IP address, cookie or account.
- **Source sync.** A scheduled job, not a page visit, reads public data from unconsentingmedia.org (the Unconsenting Media list), bechdeltest.com (year pages and the feed of recent additions) files.tmdb.org (TMDB's daily id exports) and api.themoviedb.org (TMDB id lookups by IMDb id, with MIDB's TMDB API token). These requests send no reader data, only the `MIDB-sync` User-Agent, which names the project's repository, and the token on the TMDB lookups.
- **Rate limiting.** The rate limiter sends a key to Cloudflare's rate-limit service and counts it for the window set in `wrangler.jsonc`: the reader's IP address for search, or the account id for the username check.

## Signing in

Sign-in is provided by Hanko (`hanko.io`).

- **Hanko** holds the sign-in method and the account's email address.
- **The `hanko` session cookie** is set on sign-in and identifies the session to MIDB.
- **MIDB's own database** (Cloudflare D1) stores, for each account:
  - the Hanko account id;
  - the email address;
  - the role (user, moderator or administrator);
  - the username and avatar the account holder picks.

The email address is shown only on the account's own profile page. Other readers see only the username and avatar. Signing out ends the session on Hanko and clears the cookie.

## Ratings and comments

The database has tables for community ratings and comments, but the site has no way to submit them yet. When it does, this file will say what is stored and who can see it.

## Contact

Questions: [issues](https://github.com/Against-Misogyny-in-Movies/MIDB/issues). Security problems: report privately as [SECURITY.md](SECURITY.md) says.
