# Plan: migrate the production database on deploy

## Why

After the Oct 24 schema work (`0001`, `0002_titles_spine`), production served 500s on every title page and an empty landing: the code reads `titles` and `title_bechdel`, the production database was still at `0000` (`movies`, `movie_bechdel`). Nothing applied migrations to production, and this cloud session cannot reach it (raw TCP to Postgres is blocked here). The maintainer chose to have Vercel apply migrations on production deploys.

## Design

- `db/scripts/migrateOnDeploy.ts`, first step of `vercel.json`'s `buildCommand` (through `npx --yes bun@1.4.4`, like install and build).
- `deployMigration(env)` (unit-tested) decides: `VERCEL_ENV=production` → migrate `DB_CONNECTION`; anything else → skip, so a preview of an unmerged branch never changes the production schema; Production without `DB_CONNECTION` → fail the build.
- The migration itself is the existing `migrateDatabase(url)` (one connection), the same path the `db` test project runs from zero on every CI run. Drizzle's migrator applies all pending migrations in one transaction: a failure rolls back and fails the deploy, so the previous deployment keeps serving.
- Seeding stays manual.

## Rehearsal (local, before merging)

A database at `0000` built by the migrator, holding legacy rows (an IMDb film, a `tmdb-tv:1399` series, a `tmdb:999` film with year 0, Bechdel ratings, UM links, a cached DDD tag, an Auth.js-style user). Vercel's exact install and build commands ran from a clean copy with Bun 1.1.43 first on `PATH` and `VERCEL_ENV=production`:

- Migrations applied, then the build. `titles` holds the film, the series (`kind tv`, `tmdb_id 1399`) and the `tmdb:` film (`tmdb_id 999`, year `NULL`); both Bechdel ratings kept; both UM links moved to `title_um`; old tables and Auth.js columns dropped; 3 migrations recorded.
- The built app served `/`, `/movie/76341`, `/movie/582014`, `/movie/999`, `/tv/1399` with 200 from that database: landing counts and hero films back, Mad Max with Bechdel 3/3, 2 concerns, Harmful.
- A second production deploy applied nothing. `VERCEL_ENV=preview` skipped. Production without `DB_CONNECTION` failed with a clear message.
- A database with the `0000` tables but no `drizzle.__drizzle_migrations` rows fails on `relation "user" already exists` and rolls back (rows untouched; only the empty `drizzle` schema remains). Recovery, verified: insert `0000`'s `hash` (sha256 of the `.sql` file, identical to what the migrator records) and `created_at` (journal `when`, `1780611640558`), then deploy again: `0001` and `0002` apply.

## Before the first production run

Snapshot the production database (provider backup or `pg_dump`): the migration runs unattended.
