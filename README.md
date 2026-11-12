# MIDB

MIDB (Movie Information Database, working title) is a SvelteKit app that shows movies and TV series through a diversity and content-safety lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media advisories and Does The Dog Die trigger tags.

## Prerequisites

- [Node.js](https://nodejs.org) 22.18 or later, with [pnpm](https://pnpm.io) (`corepack enable` installs the version in `packageManager`)

## Local setup

```sh
pnpm install
cp .env.example .env
pnpm db:migrate:local && pnpm db:seed:movies && pnpm db:seed:um
pnpm dev
```

`.env` also holds the Worker's secrets and public values, which `pnpm dev` reads through Wrangler. `pnpm preview` builds the site and runs the built Worker locally with `wrangler dev` on port 4173; it reads `.dev.vars` if that file exists, else `.env`. The database is a local D1 (SQLite) in `.wrangler/state`, shared by `pnpm dev`, `pnpm preview` and the scripts; no account, Docker or database server is needed. Delete `.wrangler/state` and run the steps above again to start from empty. The `db:seed:*` and `db:backfill:tmdb` scripts take `--remote` to write to the deployed D1 over the Cloudflare API, which needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` in `.env`. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`, and sign-in needs a Hanko tenant in `PUBLIC_HANKO_API_URL`.

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
