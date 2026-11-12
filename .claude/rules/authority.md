# Authority

Each source owns its own data. The Bechdel Test (bechdeltest.com), Unconsenting Media (unconsentingmedia.org), Does the Dog Die and TMDB are the record for what they publish. MIDB stores Bechdel and UM data by reference (`title_bechdel`, `title_um` → `um_source`) and fetches DDD and TMDB live. It never edits a source's values. A wrong match (a UM entry bound to the wrong title) is fixed in the matcher (`db/lib/normalizeTitle.ts`, `src/lib/server/data/um-candidates.ts`), never by editing seeded rows by hand.

MIDB's own judgements are code. The verdict and its tiers are `src/lib/media/utils/verdict.ts`, and the tones mirror it in `src/lib/media/utils/tones.ts`. Copy that explains them (`/resources`, Methodology) states what the code computes, and changes with it.

Which doc wins:

- `PRODUCT.md`: product shape and audience.
- `DESIGN.md`: the visual system.
- `docs/architecture.md`: how the code is split, and the living file map.
- The live plan in `docs/plans/`: the work in flight. Its decisions are settled unless the user reopens them.
- `docs/phases/STATUS.md`: which phase is open.

A plan never overrides the rules files. A rule change is made in the file that owns it.

Who owns which rule:

- Code: `.claude/rules/code-standards.md`.
- Styling: `.claude/rules/style-standards.md`.
- User-facing copy: `.claude/rules/copy-standards.md`.
- Docs, plans and `docs/phases/STATUS.md`: `.claude/rules/docs-standards.md`.
- Commits and merges: `.claude/rules/commit-standards.md`.
- Branches and deploys: `.claude/rules/deploy-standards.md`.

Who does which job:

- A plan with several phases: `orchestrator`.
- One phase: `implementer`.
- Reviewing a diff: `reviewer`.
- Reviewing screens, or doing design work: `ux`, through the Impeccable skill.
- Checking user-facing copy against the code: `copy-judge`.
