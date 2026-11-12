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

- **Production** deploys only through `.github/workflows/deploy.yml` on a push to `main`. Migrations apply before the new Worker version goes live, and a failure at any step stops the deploy. `docs/architecture.md`, Deploy, has the steps and the settings they read.
- **Previews** come from pull requests whose branch is in this repository (Dependabot's excluded, since it gets no secrets): the workflow migrates the separate preview D1 database and deploys the preview Worker. Previews from several pull requests share that Worker and its database, and the latest push wins. A fork's pull request gets tests only and no secrets, and `pull_request_target` is never used.
- **Pulling a bad deploy.** Revert the commit on `main`, or roll back or promote a version in Cloudflare (`wrangler rollback`). Restore the data with D1 Time Travel from the bookmark the run logged.
- **Migrations.** A migration is never rolled back by hand: fix forward with a new migration.

## Who merges and deploys

- **Agents** never merge to `main`, deploy by hand, promote a deployment, or change production settings (secrets, domains, databases) unless the user asks for it in that session. When the user does ask, the agent reports what it did and the deployment URL.
- **A person with write access** merges a pull request once CI is green.
