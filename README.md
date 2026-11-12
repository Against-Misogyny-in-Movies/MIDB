# MIDB

MIDB (Movie Information Database, working title) is a SvelteKit app that shows movies and TV series through a diversity and content-safety lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media advisories and Does The Dog Die trigger tags.

## Prerequisites

- [Node.js](https://nodejs.org) 22.18 or later, with [pnpm](https://pnpm.io) (`corepack enable` installs the version in `packageManager`)
- [Docker](https://docs.docker.com/get-docker/) (for the local Postgres)

## Local setup

```sh
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:migrate && pnpm db:seed:movies && pnpm db:seed:um
pnpm dev
```

`.env.example` points `DB_CONNECTION` at the compose database. The compose service runs `postgres:16`. A `db-data` volume created by the earlier `postgres:15` image will not start on 16. Local data can be reseeded, so recreate the volume with `docker compose down -v`, then run the steps above again. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`, and sign-in needs a Hanko tenant in `PUBLIC_HANKO_API_URL`.

## Deploy

Vercel builds from `vercel.json` with pnpm (the version in `packageManager`) on the Node 22 that `engines` selects. Production deploys apply pending migrations to `DB_CONNECTION` before the build (`db/scripts/migrateOnDeploy.ts`); preview deploys skip that step. A failed migration fails the deploy and leaves the database unchanged. Seeding stays manual.

## Tests

```sh
pnpm test:unit --run   # no database needed
docker compose exec db createdb -U postgres midb_test   # once
pnpm test:db           # data-layer tests against real Postgres
```

`pnpm test:db` reads `TEST_DB_CONNECTION` (in `.env.example`, pointing at `midb_test` on the compose server). Each run wipes that database and migrates it from zero. It never uses `DB_CONNECTION`.

## Further reading

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to propose a change; the rules it follows are in [`.claude/rules/`](.claude/rules) ([`AGENTS.md`](AGENTS.md) is the entry point for agents).
- [`docs/architecture.md`](docs/architecture.md): architecture reference; [`docs/INDEX.md`](docs/INDEX.md) lists every doc and section.
- [`PRIVACY.md`](PRIVACY.md), [`SECURITY.md`](SECURITY.md), [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md): what the site stores and sends, how to report a vulnerability or a barrier, and the sources' terms.
- [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md): visual system and product context, read by the Impeccable design skill in `.claude/skills/impeccable`.
