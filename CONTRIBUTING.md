# Contributing

Contributions are released under the [Apache-2.0 License](LICENSE). Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before starting

- Follow [README.md](README.md), Local setup, until `pnpm test:unit --run` passes.
- For anything beyond a small fix, open an issue first to agree the approach.
- Report a wrong rating, flag or warning with the "Source data or match problem" form. MIDB never edits a source's values: a wrong value is corrected at the source, and a wrong match is corrected here ([.claude/rules/authority.md](./.claude/rules/authority.md)).
- Report security problems privately ([SECURITY.md](SECURITY.md)).

## Making a change

1. **Branch.** Fork, then branch from `main`, named `<type>/<short-slug>` (`fix/um-year-match`); see [.claude/rules/deploy-standards.md](./.claude/rules/deploy-standards.md), Branches.
2. **Check before pushing.** Run the baseline in [.claude/rules/code-standards.md](./.claude/rules/code-standards.md), Checking a change. CI (`.github/workflows/tests.yml`) runs the same.
3. **Commit subjects.** Use `<type>: <summary>`, with type `fix`, `feat`, `refactor`, `style` or `repo` ([.claude/rules/commit-standards.md](./.claude/rules/commit-standards.md)).
   - The `commit-msg` hook that `pnpm install` sets up (`.githooks/`) enforces it.
   - `pnpm commit:check "<subject>"` checks one by hand.
4. **The pull request title** uses the same format. Pull requests are squash-merged, so the title becomes the commit on `main`. If readers lose a feature, saved data or a URL, add a `Breaking: <what readers lose>` line to the squash body. CI checks the title and every commit subject; the template lists the other checks.

## Conventions

- **Rules:** code [.claude/rules/code-standards.md](./.claude/rules/code-standards.md), markup and CSS [.claude/rules/style-standards.md](./.claude/rules/style-standards.md), user-facing text [.claude/rules/copy-standards.md](./.claude/rules/copy-standards.md), docs [.claude/rules/docs-standards.md](./.claude/rules/docs-standards.md) (current state only; history is in git).
- **Design work:** it goes through `DESIGN.md` and the Impeccable skill (`.claude/skills/impeccable`).
- **Privacy:** a change that makes the site send, store or share something new updates [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) in the same pull request.
- **Never commit** `.env`, secrets, database dumps or build output.

The Claude Code files in `.claude/` and `AGENTS.md` are the same rules written for agents. Contributing does not require them.
