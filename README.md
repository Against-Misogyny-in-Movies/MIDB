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

`.env` also holds the Worker's secrets and public values, which `pnpm dev` reads through Wrangler. `pnpm preview` builds the site and runs the built Worker locally with `wrangler dev` on port 4173; it reads `.dev.vars` if that file exists, else `.env`. The database is a local D1 (SQLite) in `.wrangler/state`, shared by `pnpm dev`, `pnpm preview` and the scripts; no account, Docker or database server is needed. Delete `.wrangler/state` and run the steps above again to start from empty. The `db:sync:*` and `db:backfill:tmdb` scripts take `--remote` to write to the deployed D1 over the Cloudflare API, which needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `.env`. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`, and sign-in needs a Hanko tenant in `PUBLIC_HANKO_API_URL`.

## Daily source sync

`.github/workflows/sync-sources.yml` runs `pnpm db:sync:all --remote` against the deployed D1 every day at 09:23 UTC (with `--full` on Sundays, which rereads every Bechdel Test year), and on demand from the Actions tab. It runs only on the canonical repository and needs these repository secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` and `TMDB_API_TOKEN`. A failed step fails the run and skips the steps after it; GitHub notifies the person who last changed the schedule. In a public repository, GitHub disables a scheduled workflow after 60 days without repository activity; re-enable it from the Actions tab (any commit also resets the clock).

## Deploy

Not set up yet. The site is built for Cloudflare Workers (`wrangler.jsonc`, `@sveltejs/adapter-cloudflare`) and the deploy workflow is the last phase of `docs/plans/plan-cloudflare-d1-comments.md`. `pnpm build` writes the Worker to `.svelte-kit/cloudflare/_worker.js`.

## Tests

```sh
pnpm test:unit --run   # no database needed
pnpm test:db           # data-layer tests against a local D1
```

`pnpm test:db` runs on its own local D1 in `.wrangler/test-state`, which each run wipes and migrates from zero. It needs no secrets, network or Docker.

## Further reading

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to propose a change; the rules it follows are in [`.claude/rules/`](.claude/rules) ([`AGENTS.md`](AGENTS.md) is the entry point for agents).
- [`docs/architecture.md`](docs/architecture.md): architecture reference; [`docs/INDEX.md`](docs/INDEX.md) lists every doc and section.
- [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md): what the site stores and sends, how to report a vulnerability or a barrier, and the sources' terms.
- [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md): visual system and product context, read by the Impeccable design skill in `.claude/skills/impeccable`.
