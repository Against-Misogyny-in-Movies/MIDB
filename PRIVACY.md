# Privacy

MIDB has no trackers, analytics or advertising, and sells or shares no data. This file says what the site stores and sends today. It changes in the same commit as any change to what the code stores or sends (`.claude/rules/code-standards.md`, Making a change).

## Reading the site

A reader who does not sign in gives MIDB no personal data.

- **The browser stores** one value: the chosen theme, in `localStorage` (`theme`). It never leaves the browser.
- **Third-party requests** from the browser: none. Film posters load from MIDB's own `/img/tmdb/` path, and the Inter Tight font is served from MIDB.
- **MIDB's own server** looks up each page's data on TMDB and Does the Dog Die, and fetches each poster from `image.tmdb.org` (TMDB). These requests carry the title or file being looked up, never anything about the reader, so TMDB sees MIDB's server and not the reader's IP address or browser.
- **Hosting.** The site runs on Cloudflare Workers, which keeps standard request logs (IP address, URL, time) under its own policy. The server also caches the TMDB and Does the Dog Die responses it fetches, and public pages and posters, in Cloudflare's cache; those hold film data only, never anything about a reader.

## Signing in

Sign-in is provided by Hanko (`hanko.io`).

- **Hanko** holds the sign-in method and the account's email address.
- **The `hanko` session cookie** is set on sign-in and identifies the session to MIDB.
- **MIDB's own database** stores, for each account:
  - the Hanko account id;
  - the email address;
  - the role (user, moderator or administrator);
  - the username and avatar the account holder picks.

The email address is shown only on the account's own profile page. Other readers see only the username and avatar. Signing out ends the session on Hanko and clears the cookie.

## Ratings and comments

The database has tables for community ratings and comments, but the site has no way to submit them yet. When it does, this file will say what is stored and who can see it.

## Contact

Questions: [issues](https://github.com/Against-Misogyny-in-Movies/MIDB/issues). Security problems: report privately as [SECURITY.md](SECURITY.md) says.
