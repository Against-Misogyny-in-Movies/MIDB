# MIDB: agent rules

The rules for every session are in `.claude/rules/authority.md`; read it first. It says which doc and which rules file owns what.

- **Code:** any session or agent that changes code follows `.claude/rules/code-standards.md`.
- **Markup and CSS:** follow `.claude/rules/style-standards.md` as well.
- **User-facing text:** follow `.claude/rules/copy-standards.md`.
- **Docs, plans, `docs/phases/STATUS.md` and agent files:** follow `.claude/rules/docs-standards.md` (current state only, no history logs).
- **Commits:** every commit follows `.claude/rules/commit-standards.md` (`<type>: <summary>`, with type `fix`, `feat`, `refactor`, `style` or `repo`). Branches land on `main` squashed.
- **Branches and deploys:** follow `.claude/rules/deploy-standards.md`.

Find docs through `docs/INDEX.md`. It lists every file an agent reads, its size, and the heading tree of the long ones with line ranges. Read a section, not a whole file: `bun run docs:section architecture "Caching policy"`. After changing a doc's headings, run `bun run docs:index`; a test fails while the index is stale.

## Commands

- `bun run dev`: the dev server.
- `bun run check`: `svelte-check`.
- `bun run lint`: Prettier and ESLint.
- `bun run test:unit --run`: the Vitest `unit` project. `bunx vitest run <file>` runs one file.
- `bun run test:db`: the Vitest `db` project, against Postgres from `docker compose up -d db`.
- `bun run build`: a production build.
- `bun run commit:check "<subject>"`: checks a commit subject (the `commit-msg` hook runs it for you).
- `bun run docs:index` / `bun run docs:section <file> "<heading>"`: writes the docs index / prints one section.
- `bun run db:*`: migrations, seeds and backfills (`docs/architecture.md`, Seeding).

The verification baseline that every finished task reports is in `.claude/rules/code-standards.md`, Checking a change.

## Agents

The agents live in `.claude/agents`:

- `orchestrator` runs a plan with several phases;
- `implementer` writes one phase;
- `reviewer` reviews a diff and is read-only;
- `ux` reviews screens, or does design work through the Impeccable skill (`/impeccable`);
- `copy-judge` checks user-facing copy against the copy standards and the code it describes, and is read-only.

After `implementer` reports a green exit, run `reviewer` on the diff. Also run `ux` when `src/routes` or `src/lib/components` changed, and `copy-judge` when user-facing text changed. `.claude/agents/orchestrator.md` sets the models and the one review round.

## Cloud sessions

`.claude/hooks/session-start.sh` installs dependencies in a cloud session. Cloud sessions have no Docker by default, so `bun run test:db` may not run there. Report it as not run, as `.claude/rules/code-standards.md` (Checking a change) says.
