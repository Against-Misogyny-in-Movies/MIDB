<!-- Title: `<type>: <summary>` (fix, feat, refactor, style or repo), at most 72 characters. It becomes the squash commit on main (.claude/rules/commit-standards.md). -->

## What and why

<!-- What changed, and why. Link the issue it closes and the plan phase, if any (docs/phases/STATUS.md). If readers lose a feature, saved data or a URL, keep a `Breaking: <what readers lose>` line in the squash body. -->

## Sources and claims

<!-- For a change to a verdict, a source match or user-facing copy that explains them: the code that decides it (verdict.ts, the matcher, the sync). Delete this section otherwise. -->

## Checks

- [ ] `bun run check`
- [ ] `bun run lint`
- [ ] `bun run test:unit --run`
- [ ] `bun run test:db` (when the data layer could move)
- [ ] `bun run build`
- [ ] A schema change ships its generated migration (`bun run db:generate`)
- [ ] `bun run docs:index` run if doc headings or doc citations changed
- [ ] `docs/architecture.md` updated for structural changes; `PRIVACY.md` and `SECURITY.md` for a new request, cookie or stored data
- [ ] No secrets, `.env`, database dumps or build output committed
