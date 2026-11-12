# MIDB

MIDB (Movie Information Database, working title) is a SvelteKit app that shows movies and TV series through a diversity and content-safety lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media advisories and Does The Dog Die trigger tags.

## Prerequisites

- [Node.js](https://nodejs.org) 22.18 or later, with [pnpm](https://pnpm.io) (`corepack enable` installs the version in `packageManager`)

## Local setup

```sh
pnpm install
cp .env.example .env
pnpm db:migrate:local && pnpm db:sync:all --local
pnpm dev
```

`db:sync:all` reads the Unconsenting Media and Bechdel Test sites and needs the network but no keys; the first run sweeps every Bechdel Test year at one request a second, which takes a few minutes. `--fixtures` loads a few trimmed responses instead and works offline. With `TMDB_API_TOKEN` set it also looks up TMDB ids (not with `--fixtures`) and scores popularity; without one it says so and skips both.

`.env` also holds the Worker's secrets and public values, which `pnpm dev` reads through Wrangler. `pnpm preview` builds the site and runs the built Worker locally with `wrangler dev` on port 4173; it reads `.dev.vars` if that file exists, else `.env`. The database is a local D1 (SQLite) in `.wrangler/state`, shared by `pnpm dev`, `pnpm preview` and the scripts; no account, Docker or database server is needed. Delete `.wrangler/state` and run the steps above again to start from empty. The `db:sync:*` and `db:backfill:tmdb` scripts take `--remote` to write to the deployed D1 over the Cloudflare API, which needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `.env`. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`. Without `ANTHROPIC_API_KEY`, a new or edited comment that passes the blocklist waits for a moderator; with `MODERATION_DEV_AUTO_APPROVE=1` it is published instead, only when `PUBLIC_ORIGIN` is on `localhost`, `127.0.0.1` or `[::1]`. Passkey sign-in and sign-up work on `localhost` with no secrets; the Google and Discord buttons appear only when their `GOOGLE_*` or `DISCORD_*` client id and secret are set. `PUBLIC_ORIGIN` must be the address the site is opened at (`http://localhost:5173` for `pnpm dev`, `http://localhost:4173` for `pnpm preview`), because sign-in accepts requests from that origin only.

## Daily source sync

`.github/workflows/sync-sources.yml` runs `pnpm db:sync:all --remote` against the deployed D1 every day at 09:23 UTC (with `--full` on Sundays, which rereads every Bechdel Test year), and on demand from the Actions tab. It runs only on the canonical repository and needs these repository secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` and `TMDB_API_TOKEN`. A failed step fails the run and skips the steps after it; GitHub notifies the person who last changed the schedule. In a public repository, GitHub disables a scheduled workflow after 60 days without repository activity; re-enable it from the Actions tab (any commit also resets the clock).

## Deploy

Production deploys from `.github/workflows/deploy.yml` on every push to `main`: build, log the D1 Time Travel bookmark, apply the migrations, then deploy the Worker. A failed step stops the run before the next. A pull request from a branch in the same repository uploads a version of a separate preview Worker with its own database. A pull request from a fork runs tests only and gets no secrets. A daily job deletes the accounts a failed passkey sign-up left behind.

To pull a bad deploy, revert the commit on `main`, or roll back or promote a version in the Cloudflare dashboard (`wrangler rollback`). Data comes back from D1 Time Travel, using the bookmark the run logged. A migration is fixed forward with a new one.

### Deploy your own

A fork or a copy needs a Cloudflare account and a domain in a Cloudflare zone. The Workers Paid plan keeps D1 Time Travel history longer. The steps run from a checkout, after `pnpm install` and `pnpm exec wrangler login`.

1. **D1 databases.** Create two: `pnpm exec wrangler d1 create midb` and `pnpm exec wrangler d1 create midb-preview`. In `wrangler.jsonc`, replace `REPLACE-WITH-D1-DATABASE-ID` and `REPLACE-WITH-PREVIEW-D1-DATABASE-ID` with their ids.
2. **Rate limits.** Each `namespace_id` in `wrangler.jsonc` must be unique in the account; change the numbers if another Worker already uses them.
3. **Origins.** Replace `REPLACE-WITH-PRODUCTION-ORIGIN.example` and `REPLACE-WITH-PREVIEW-ORIGIN.example` in `vars` with the two origins, and add a custom-domain route for each to its environment in `wrangler.jsonc`. The `PUBLIC_*` values are inlined into the build, so the repository variables below must match these `vars`.
4. **Turnstile.** Create a Turnstile widget for the production domain and set its site key as `PUBLIC_TURNSTILE_SITE_KEY` in `vars`. Without a real key, passkey sign-up is not checked.
5. **First preview deploy.** Run `pnpm build && pnpm exec wrangler deploy --env preview` once; `wrangler versions upload`, which the workflow uses for previews, needs the Worker to exist.
6. **Worker secrets.** Set each with `pnpm exec wrangler secret put <NAME>` for production and with `--env preview` for the preview Worker. The names are the `Secrets` in `src/lib/server/env.ts`, listed in `.env.example`:
   - `BETTER_AUTH_SECRET` (required: a long random string);
   - `TMDB_API_TOKEN` and `DDD_API_KEY` (title pages);
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` (each provider's button appears only when both of its values are set);
   - `TURNSTILE_SECRET_KEY` (the secret of the widget);
   - `ANTHROPIC_API_KEY` (comment moderation; without it every comment waits for a moderator);
   - `MODERATION_EXTRA_TERMS` (optional private blocklist terms, comma or newline separated).

   `MODERATION_DEV_AUTO_APPROVE` is for localhost only and is not set in a deployment.

7. **OAuth apps.** Register `<origin>/api/auth/callback/google` as a redirect URI of the Google OAuth client and `<origin>/api/auth/callback/discord` as one of the Discord application, for each origin that signs in. Discord sign-in links to an existing account only when Discord reports the email verified.
8. **GitHub secrets.** In the repository's Actions secrets: `CLOUDFLARE_API_TOKEN` (an API token with Workers Scripts edit and D1 edit permissions), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` (the production database) and `TMDB_API_TOKEN`.
9. **GitHub variables.** In the repository's Actions variables: `PUBLIC_ORIGIN`, `PREVIEW_ORIGIN` and `PUBLIC_TURNSTILE_SITE_KEY`, equal to the matching `vars` in `wrangler.jsonc`.
10. **Canonical repository.** `deploy.yml` and `sync-sources.yml` run only when `github.repository` is `Against-Misogyny-in-Movies/MIDB`. Change that string in both files (it appears in each job's `if`) to the new repository's full name.
11. **First load.** Put `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `.env`, then run `pnpm db:migrate:remote` and `pnpm db:sync:all --remote`. The next push to `main` deploys; the daily sync keeps the data current.
12. **First administrator.** Sign in once on the site, then run `pnpm db:seed:admin --username <username> --remote`.

## Tests

```sh
pnpm test:unit --run   # no database needed
pnpm test:db           # data-layer tests against a local D1
pnpm test:integration  # Playwright against the built Worker (pnpm preview)
```

`pnpm test:db` runs on its own local D1 in `.wrangler/test-state`, which each run wipes and migrates from zero. It needs no secrets, network or Docker. `pnpm test:integration` starts `pnpm preview` itself and needs the local D1 migrated and loaded with the fixtures (`pnpm db:migrate:local && pnpm db:sync:all --local --fixtures`) and a `.dev.vars` with `PUBLIC_ORIGIN=http://localhost:4173`; the specs that need TMDB skip without `TMDB_API_TOKEN` there. `.github/workflows/tests.yml` shows the sequence.

## Further reading

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to propose a change; the rules it follows are in [`.claude/rules/`](.claude/rules) ([`AGENTS.md`](AGENTS.md) is the entry point for agents).
- [`docs/architecture.md`](docs/architecture.md): architecture reference; [`docs/INDEX.md`](docs/INDEX.md) lists every doc and section.
- [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md): what the site stores and sends, how to report a vulnerability or a barrier, and the sources' terms.
- [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md): visual system and product context, read by the Impeccable design skill in `.claude/skills/impeccable`.
