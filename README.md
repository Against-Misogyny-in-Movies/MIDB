# MIDB

MIDB (Movie Information Database, working title) is a SvelteKit app that shows movies and TV series through a diversity and content-safety lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media advisories and Does The Dog Die trigger tags.

## Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://docs.docker.com/get-docker/) (for the local Postgres)

## Local setup

```sh
bun install
cp .env.example .env
docker compose up -d db
bun run db:migrate && bun run db:seed:movies && bun run db:seed:um
bun run dev
```

`.env.example` points `DB_CONNECTION` at the compose database. The compose service runs `postgres:16`. A `db-data` volume created by the earlier `postgres:15` image will not start on 16. Local data can be reseeded, so recreate the volume with `docker compose down -v`, then run the steps above again. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`, and sign-in needs a Hanko tenant in `PUBLIC_HANKO_API_URL`.

## Deploy

Vercel builds from `vercel.json` with Bun 1.4.4 (pinned through `npx`, since Vercel does not read `packageManager` for Bun). Production deploys apply pending migrations to `DB_CONNECTION` before the build (`db/scripts/migrateOnDeploy.ts`); preview deploys skip that step. A failed migration fails the deploy and leaves the database unchanged. Seeding stays manual.

## Tests

```sh
bun run test:unit --run   # no database needed
docker compose exec db createdb -U postgres midb_test   # once
bun run test:db           # data-layer tests against real Postgres
```

`bun run test:db` reads `TEST_DB_CONNECTION` (in `.env.example`, pointing at `midb_test` on the compose server). Each run wipes that database and migrates it from zero. It never uses `DB_CONNECTION`.

## Further reading

- [`AGENTS.md`](AGENTS.md): working rules for this codebase.
- [`.CLAUDE/architecture.md`](.CLAUDE/architecture.md): architecture reference.
- [`DESIGN.md`](DESIGN.md) and [`PRODUCT.md`](PRODUCT.md): visual system and product context, read by the Impeccable design skill in `.claude/skills/impeccable`.
