# Commit standards

Every session, agent and contributor that commits follows these. A reviewer reports a breach as a finding.

`bun run commit:check` (`scripts/git/commit-message.ts`) checks the subject line:

- the `commit-msg` hook in `.githooks/` runs it on every commit (`bun install` sets `core.hooksPath`);
- CI runs it on every pull request's commits and its title.

Do not skip the hook with `--no-verify`; reword the message.

## Subject line

`<type>: <summary>`, for example `fix: Series pages show the UM picker when no year matches`.

| Type       | For                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `feat`     | Something new a reader can see or do: a page, a section, a source, a filter, an account feature.                                         |
| `fix`      | Behaviour that was wrong: a verdict, a source match, a crash, a cache leak, a layout bug.                                                |
| `refactor` | Code that changes no behaviour: a split, a rename, a move, a speed-up.                                                                   |
| `style`    | How the pages look, with no behaviour change (design system, layout, theme, motion), or code formatting only.                            |
| `repo`     | Everything around the site: docs, tests on their own, scripts, CI, dependencies, config, agent files, migrations with no visible change. |

- **One type per commit.** A change that fits two is split, or takes the type of what the reader notices (a fix with its test is `fix`).
- **The summary.** It starts like a sentence and says what changed, not how the work went: no "WIP", PR or phase numbers on their own, no "address review".
- **Length and form.** At most 72 characters in all, no closing period, no scope in brackets.

## Body

- **What goes in it.** A blank line, then what changed and why, wrapped near 72 columns. Measured numbers, deviations from a plan and findings left unfixed go here (`.claude/agents/orchestrator.md`).
- **`Breaking:` lines.** A change that removes a feature, deletes or invalidates something a user saved (an account, a comment, a rating), or changes a public URL carries a `Breaking: <what readers lose>` line, written for readers.
- **Attribution.** End with the attribution lines the session's instructions give, if any.

## Checkpoints

- **Commit and push often.** An agent that writes code, tests or docs commits a typed checkpoint after each step that leaves `bun run check`, `bun run lint` and its quick tests green, and pushes it to the session's work branch. Example: `feat: Comment votes endpoint, checkpoint`.
- **What a checkpoint holds.** It follows these standards like any commit. It never holds a file that must not be committed: secrets, `.env`, a scratch script, a database dump.
- **Where it goes.** Push with `git push -u origin <branch>` to the branch the session's harness or brief names, never to `main`.

## Squash

- **Squash merges.** Every branch lands on `main` as one squash commit. There are no merge commits and no rebased stacks on `main`.
- **The squash commit.**
  - Its subject is the pull request title, so the title follows Subject line.
  - Its body sums up the branch and keeps every measure, `Breaking:` and attribution line from the branch's commits.
- **Commits on a branch** follow these standards too. Checkpoints are still typed.
