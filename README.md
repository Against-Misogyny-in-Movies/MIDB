# MIDB

[![Accessibility: WCAG 2.2 AA target](https://img.shields.io/badge/accessibility-WCAG_2.2_AA_target-6d28d9)](ACCESSIBILITY.md)

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

Production deploys from `.github/workflows/deploy.yml` on every push to `main`, and a pull request from a branch in the same repository deploys the preview Worker. The rules are in [`.claude/rules/deploy-standards.md`](.claude/rules/deploy-standards.md) (branches, deploys, rollbacks) and the steps and settings in [`docs/architecture.md`](docs/architecture.md), Deploy.

### Deploying a copy

A fork or a copy needs a Cloudflare account and a domain in a Cloudflare zone. The Workers Paid plan keeps D1 Time Travel history longer. The steps run from a checkout, after `pnpm install` and `pnpm exec wrangler login`.

1. **D1 databases.** Create two: `pnpm exec wrangler d1 create midb` and `pnpm exec wrangler d1 create midb-preview`. In `wrangler.jsonc`, replace `REPLACE-WITH-D1-DATABASE-ID` and `REPLACE-WITH-PREVIEW-D1-DATABASE-ID` with their ids.
2. **Rate limits.** Each `namespace_id` in `wrangler.jsonc` must be unique in the account; change the numbers if another Worker already uses them.
3. **Origins.** `wrangler.jsonc` serves production on `againstmisogyny.org` and the preview on `preview.againstmisogyny.org`, each as a custom-domain route with a matching `PUBLIC_ORIGIN` in its `vars` block. A copy replaces both hostnames, in `routes` and in `vars`, with domains in its own Cloudflare zone.
4. **Turnstile.** Create a Turnstile widget for each domain and set its site key as `PUBLIC_TURNSTILE_SITE_KEY` in both `vars` blocks (production and `env.preview`). Without `TURNSTILE_SECRET_KEY`, passkey sign-up is not checked.
5. **Builds.** The `PUBLIC_*` values are inlined into each build, so the workflows build with the target's own values: the repository variables in step 8 for the origin and the site key, and `wrangler.jsonc` for the TMDB values. A build that differs from `wrangler.jsonc` fails the run. For a manual build, set them in the environment: `PUBLIC_ORIGIN=<origin> PUBLIC_TURNSTILE_SITE_KEY=<key> pnpm build`, then `pnpm exec wrangler deploy` (add `--env preview` for the preview). The first run of the workflow creates the preview Worker, so no separate deploy is needed.
6. **Worker secrets.** Set each with `pnpm exec wrangler secret put <NAME>` for production and with `--env preview` for the preview Worker. The names are the `Secrets` interface in `src/lib/server/env.ts` (`.env.example` lists them). `BETTER_AUTH_SECRET` is required: a long random string. `LETTERBOXD_API_KEY` and `LETTERBOXD_API_SECRET` are optional: without them film pages show no Letterboxd rating. Without `ANTHROPIC_API_KEY`, a comment that passes the blocklist waits for a moderator. `MODERATION_DEV_AUTO_APPROVE` is for localhost only and is not set in a deployment.
7. **OAuth apps.** Register `<origin>/api/auth/callback/google` as a redirect URI of the Google OAuth client and `<origin>/api/auth/callback/discord` as one of the Discord application, for each origin that signs in. Discord sign-in links to an existing account only when Discord reports the email verified.
8. **GitHub secrets and variables.** In the repository's Actions settings:
   - secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` (the production database) and `TMDB_API_TOKEN`;
   - variables: `PUBLIC_ORIGIN`, `PUBLIC_TURNSTILE_SITE_KEY`, `PREVIEW_ORIGIN` and `PREVIEW_TURNSTILE_SITE_KEY`, equal to the matching `vars` in `wrangler.jsonc`.

   The token needs the permissions the workflows use: editing Workers scripts, editing D1 databases, and, once `wrangler.jsonc` has custom-domain routes, editing the zone's Workers routes. The exact permission names are Cloudflare's.

9. **Canonical repository.** `deploy.yml` and `sync-sources.yml` run only when `github.repository` is `Against-Misogyny-in-Movies/MIDB`. Change that string in both files (it appears in each job's `if`) to the new repository's full name.
10. **First load.** Put `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `.env`, then run `pnpm db:migrate:remote` and `pnpm db:sync:all --remote`. The next push to `main` deploys; the daily sync keeps the data current. The workflow migrates the preview database but does not load source data into it; `pnpm db:sync:all --remote` with the preview database's id as `CLOUDFLARE_D1_DATABASE_ID` does.
11. **First administrator.** Sign in once on the site, then run `pnpm db:seed:admin --username <username> --remote`.

## Tests

```sh
pnpm test:unit --run   # no database needed
pnpm test:db           # data-layer tests against a local D1
pnpm test:integration  # Playwright against the built Worker (pnpm preview)
```

`pnpm test:db` runs on its own local D1 in `.wrangler/test-state`, which each run wipes and migrates from zero. It needs no secrets, network or Docker.

`pnpm test:integration` starts `pnpm preview` itself. It needs:

- `PUBLIC_ORIGIN=http://localhost:4173` in `.env`, which the build reads, and in `.dev.vars`, which `wrangler dev` reads;
- the local D1 migrated and loaded with the fixtures (`pnpm db:migrate:local && pnpm db:sync:all --local --fixtures`).

The specs that need TMDB skip without `TMDB_API_TOKEN` in `.dev.vars`, and the Google and Discord specs skip without fake `GOOGLE_*` and `DISCORD_*` client values there. `.github/workflows/tests.yml` shows the sequence.

## Further reading

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to propose a change; the rules it follows are in [`.claude/rules/`](.claude/rules) ([`AGENTS.md`](AGENTS.md) is the entry point for agents).
- [`docs/architecture.md`](docs/architecture.md): architecture reference; [`docs/INDEX.md`](docs/INDEX.md) lists every doc and section.
- [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md): what the site stores and sends, how to report a vulnerability or a barrier, and the sources' terms.
- [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md): visual system and product context, read by the Impeccable design skill in `.claude/skills/impeccable`.
