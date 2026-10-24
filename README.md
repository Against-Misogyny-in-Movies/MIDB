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

`.env.example` points `DB_CONNECTION` at the compose database. Title pages need real values for `TMDB_API_TOKEN` and `DDD_API_KEY`, and sign-in needs a Hanko tenant in `PUBLIC_HANKO_API_URL`.

## Further reading

- [`AGENTS.md`](AGENTS.md): working rules for this codebase.
- [`.CLAUDE/architecture.md`](.CLAUDE/architecture.md): architecture reference.
