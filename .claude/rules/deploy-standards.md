# Deploy standards

Every session, agent and contributor that branches, merges or deploys follows these. A reviewer reports a breach as a finding.

## Branches

- **`main`** is the trunk and is always deployable. Every change lands on it as one squash commit from a pull request (`.claude/rules/commit-standards.md`, Squash).
- **Work branches** are named `<type>/<short-slug>`, with a type from the commit standards, lowercase and hyphenated: `fix/um-year-match`, `feat/comments`.
  - A work branch branches from `main`, is short-lived, and is deleted once merged.
  - An agent session keeps the branch its harness or brief names (`claude/…`, `ccr-…`).

## Versions

The site is not versioned: there are no version bumps and no tags. `package.json` stays at `0.0.1`. A `Breaking:` line in a squash commit (`.claude/rules/commit-standards.md`, Body) is the record of a change readers lose something to.

## Deploys

- **Not set up yet.** The site is built for Cloudflare Workers (`wrangler.jsonc`), and the deploy workflow is the last phase of the live plan (`docs/plans/plan-cloudflare-d1-comments.md`). Until it exists nothing deploys on a merge, and an agent never deploys by hand.
- **Migrations.** A migration is never rolled back by hand: fix forward with a new migration.

## Who merges and deploys

- **Agents** never merge to `main`, promote a deployment, or change production settings (secrets, domains, databases) unless the user asks for it in that session. When the user does ask, the agent reports what it did and the deployment URL.
- **A person with write access** merges a pull request once CI is green.
