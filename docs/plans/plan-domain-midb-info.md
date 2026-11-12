# Plan: serve the site on midb.info

The site moves from `againstmisogyny.org` to `midb.info`: production on `https://midb.info`, the preview Worker on `https://preview.midb.info`. One phase (`docs/phases/STATUS.md`, phase 7).

## Where the domain lives today

The hostname is written in two files only:

- `wrangler.jsonc`: the production `routes` pattern and `vars.PUBLIC_ORIGIN`, and the same pair under `env.preview`.
- `README.md`, Deploying a copy, step 3 (Origins), which names both hostnames.

Everything else reads the origin from `PUBLIC_ORIGIN`, so it follows the config with no code change:

- Better Auth's `baseURL`, its one trusted origin and the passkey RP id (`src/lib/server/auth/create-auth.ts`).
- The build, which inlines `PUBLIC_ORIGIN` (`src/env.ts`); `scripts/ci/public-vars.ts` fails a deploy whose build value differs from `wrangler.jsonc`.
- The moderation localhost switch (`src/lib/server/moderation/decide.ts`), which only tests for localhost.

The `github.com/Against-Misogyny-in-Movies/MIDB` links (footer, landing, `/resources`, `PRIVACY.md`, `ACCESSIBILITY.md`, issue templates, the sync user agent, the workflow `if` guards) name the repository, not the domain, and stay as they are.

## Phase 7: domain change

### In the repository

1. `wrangler.jsonc`: replace `againstmisogyny.org` with `midb.info` in the production `routes` and `vars.PUBLIC_ORIGIN`, and `preview.againstmisogyny.org` with `preview.midb.info` in `env.preview`.
2. `README.md`, Deploying a copy, step 3: name the new hostnames.
3. `pnpm cf:types`, and commit `worker-configuration.d.ts` only if it changes (it types `PUBLIC_ORIGIN` as `string`, so it should not).
4. A final `grep -ri againstmisogyny` outside `docs/plans/done/` returns nothing. `docs/plans/done/` is history and is not edited.

No test, user-facing copy, `PRIVACY.md` or `SECURITY.md` change: the site sends, stores and shares nothing new, and no page names its own domain. `DESIGN.md` and `docs/architecture.md` do not name the domain, so they do not change.

Commit: `repo: Serve production on midb.info and the preview on preview.midb.info`.

### Outside the repository (the user, before the first deploy)

An agent does not change production settings (`.claude/rules/deploy-standards.md`, Who merges and deploys), so these are the user's, and the phase lists them in its report:

1. **Cloudflare zone.** Add `midb.info` to the Cloudflare account and point the registrar's nameservers at it. The custom-domain routes create the DNS records and certificates on deploy; the API token needs the Workers routes permission for this zone.
2. **GitHub variables.** Set `PUBLIC_ORIGIN=https://midb.info` and `PREVIEW_ORIGIN=https://preview.midb.info`. They must equal `wrangler.jsonc`, or the deploy's check fails.
3. **Turnstile.** Add `midb.info` and `preview.midb.info` to the widget's hostnames (or create widgets for them), and set the site keys in `wrangler.jsonc` and the GitHub variables.
4. **OAuth apps.** Register `https://midb.info/api/auth/callback/google` and `/discord` (and the preview origin's, if it signs in) in the Google client and the Discord application.

### Exit

The verification baseline (`.claude/rules/code-standards.md`, Checking a change). The review round is `reviewer` only: no route, component or copy changes.

## Consequences

- **Passkeys are bound to the hostname.** The RP id is the origin's hostname, so a passkey made on `againstmisogyny.org` does not work on `midb.info`. No deploy has run yet (`docs/phases/STATUS.md`, Open items), so no reader holds one; after the first deploy the same change would lock passkey-only accounts out.
- **Sessions do not carry over.** The session cookie is host-scoped; with no deploy yet, nobody is signed in.

## Open question for the user

- **The old domain.** Recommended: no redirect, since `againstmisogyny.org` has never served the site. If the user keeps the domain and wants it to forward, a Cloudflare redirect rule on that zone (`againstmisogyny.org/*` → `https://midb.info/$1`, 301) does it with no Worker or repository change.
