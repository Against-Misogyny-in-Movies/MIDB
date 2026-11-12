# Security

What the site stores and sends is in [PRIVACY.md](PRIVACY.md). This file names the code behind each point.

## Network

- **Server-side requests:** the server calls TMDB (`api.themoviedb.org`, and `image.tmdb.org` for the image route) and Does the Dog Die (`www.doesthedogdie.com`), with keys that exist only on the server (`#lib/server/integrations/`). Nothing under `#lib/server/` can be imported by client code; SvelteKit enforces the boundary at build time.
- **Browser requests:** the browser calls MIDB's own `/api/*` endpoints and Hanko for sign-in. Posters come from MIDB's `/img/tmdb/` route, which fetches `image.tmdb.org` on the server (`src/routes/img/tmdb/[size]/[file]/+server.ts`); it fetches only a size in `TMDB_IMAGE_SIZES` and a file name that matches `TMDB_IMAGE_FILE` (`src/lib/media/utils/tmdbImage.ts`), and serves only an upstream `image/jpeg`, `image/png` or `image/webp`, so a request cannot choose another host or path. The font is served from `static/fonts`.
- **Caching:** public pages are cached by the CDN with a key that ignores cookies, so their loads never read the request's user (`src/lib/server/http/cache.ts`). The request hook makes any response without a `cache-control` header, or with a cookie, `private, no-store` (`src/hooks.server.ts`). Account data reaches the browser only through `private, no-store` responses: `/api/me` and the `/user` pages.
- **Authorization:** every endpoint and page that needs an account checks it with `requireUser` / `requireRole` (`src/lib/server/auth/guards.ts`). Roles are read from the database, never from the session token.
- **Rate limits:** search and username checks are rate-limited with Cloudflare Workers rate-limit bindings (`src/lib/server/http/rate-limit.ts`, `wrangler.jsonc`). A limiter outage lets requests through.

## Supply chain

- **Dependencies:** `pnpm-lock.yaml` is committed, and CI installs with `--frozen-lockfile`.
- **CI:**
  - CI (`.github/workflows/tests.yml`) runs with a read-only token, so pull requests from forks cannot write to the repository or read secrets.
  - Every action is pinned to a commit SHA.
  - Dependabot (`.github/dependabot.yml`) opens weekly updates for packages and actions, which pass the same CI.
- **Secrets:** no secret is committed. `.env` and `.dev.vars` are ignored by git, `.env.example` holds placeholders only, and `wrangler.jsonc` holds bindings and non-secret values. Production secrets are set with `wrangler secret put`; server code reads them through `src/lib/server/env.ts`.

## Reporting a vulnerability

Use the repository's Security tab, "Report a vulnerability". Do not open a public issue. Include what is affected (a page, an endpoint, a script, a dependency), how to reproduce it, and what it allows.

This is a volunteer project, so there is no fixed response time. Fixes go to `main`, which is what the site runs.
