# Security

What the site stores and sends is in [PRIVACY.md](PRIVACY.md). This file names the code behind each point.

## Network

- **Server-side requests:** the server calls TMDB (`api.themoviedb.org`) and Does the Dog Die (`www.doesthedogdie.com`), with keys that exist only on the server (`$lib/server/integrations/`). Nothing under `$lib/server/` can be imported by client code; SvelteKit enforces the boundary at build time.
- **Browser requests:** the browser calls MIDB's own `/api/*` endpoints, Hanko for sign-in, `image.tmdb.org` for posters, and Google Fonts.
- **Caching:** public pages are cached by the CDN with a key that ignores cookies, so their loads never read the request's user (`src/lib/server/http/cache.ts`). Account data reaches the browser only through `private, no-store` responses: `/api/me` and the `/user` pages.
- **Authorization:** every endpoint and page that needs an account checks it with `requireUser` / `requireRole` (`src/lib/server/auth/guards.ts`). Roles are read from the database, never from the session token.
- **Rate limits:** search and username checks are rate-limited (`src/lib/server/http/rate-limit.ts`).

## Supply chain

- **Dependencies:** `pnpm-lock.yaml` is committed, and CI installs with `--frozen-lockfile`.
- **CI:**
  - CI (`.github/workflows/tests.yml`) runs with a read-only token, so pull requests from forks cannot write to the repository or read secrets.
  - Every action is pinned to a commit SHA.
  - Dependabot (`.github/dependabot.yml`) opens weekly updates for packages and actions, which pass the same CI.
- **Secrets:** no secret is committed. `.env` is ignored by git, and `.env.example` holds placeholders only.

## Reporting a vulnerability

Use the repository's Security tab, "Report a vulnerability". Do not open a public issue. Include what is affected (a page, an endpoint, a script, a dependency), how to reproduce it, and what it allows.

This is a volunteer project, so there is no fixed response time. Fixes go to `main`, which is what the site runs.
