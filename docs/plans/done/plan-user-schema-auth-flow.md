# Plan — User schema & auth flow (end-to-end)

## Context

MIDB authenticates with **Hanko Cloud** (passwordless/passkeys). Today auth is a thin stub: `<hanko-auth>` on `/auth`, `<hanko-profile>` on `/user/dashboard`, and a JWT-cookie gate in `src/hooks.server.ts` that only returns a boolean — it verifies the cookie but exposes nothing downstream and throws away the decoded payload. The local `user` table (`db/schema/auth.ts`) is an Auth.js-era leftover (`text` PK, never populated), kept only as the FK target for `movie_trigger_tags.created_by` (`db/schema/movie.ts:72`).

The product is pivoting to **community contribution**: users submit MIDB community ratings per metric and leave comments. This needs a real user record keyed to Hanko identity, with roles, an editable profile, and history views — plus empty-but-ready submission/comment tables so the future write path is additive.

**Outcome:** a local `users` table keyed to the Hanko subject (`sub`), JIT-provisioned on first authed request, with roles + MIDB-owned profile (username, avatar); a profile page (view/edit + avatar picker), read-only comment/metric history views; empty-but-ready `community_metric_submissions` and `comments` tables; and role-aware nav. This revises an earlier draft after grounding it in the live Hanko tenant and the post-`742c612` hooks — corrections are called out inline.

---

## ⚠️ Two things to verify before building

**1. The `email` claim shape.** Hanko Cloud's session JWT includes `email`, `username`, `sub`, `session_id`, `aud`, `exp`, `iat` by default — but `email` is **version-dependent**: an **object** `{ address, is_primary, is_verified }` (newer) or a plain **string** (older). The earlier draft assumed a string into a `notNull` column → that throws on every first login if this tenant emits the object form. This plan handles **both** shapes (§5 `emailFromClaims`) and makes `users.email` **nullable** so a missing/unexpected claim degrades gracefully. Still: sign up once against `https://9c6919b1-58ec-4f71-bd6c-c2941b2d6008.hanko.io`, decode the `hanko` cookie, and confirm the shape.

**2. Boot no longer migrates.** Commit `742c612` ("fix don't migrate on startup") removed the auto-migrate from `hooks.server.ts`. Migration is now an explicit `bun run db:migrate`. The verification steps reflect this.

---

## Schema changes (`db/schema/`)

### 1. Rewrite `db/schema/auth.ts` — `users`

```ts
import { pgTable, text, varchar, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['user', 'moderator', 'administrator']);

export const users = pgTable(
	'user',
	{
		id: text('id').primaryKey(), // Hanko subject (JWT `sub`, a UUID)
		email: text('email'), // NULLABLE — claim may be absent/object-shaped; backfilled lazily
		role: userRole('role').notNull().default('user'),
		username: varchar('username', { length: 32 }), // MIDB-owned, nullable until set
		avatarKey: varchar('avatar_key', { length: 48 }), // preset icon key; null → default avatar
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('user_username_lower_idx').on(sql`lower(${t.username})`), // case-insensitive uniqueness
		index('user_role_idx').on(t.role)
	]
);
```

- `email` **nullable** (not `notNull`).
- Username uniqueness via **`lower(username)` unique index**, not column `.unique()` — Postgres `unique()` is case-sensitive, which would let `Admin`/`admin` coexist (impersonation hole). `lower(NULL)` is `NULL`; Postgres unique indexes don't collide on NULL, so nullable usernames are fine.
- Keep table name `user` so `movie_trigger_tags.created_by` (`db/schema/movie.ts:72`) resolves. Drop Auth.js cols `name`, `emailVerified`, `image`.

### 2. New `db/schema/community.ts` — empty-but-ready

```ts
import {
	pgTable,
	uuid,
	text,
	smallint,
	timestamp,
	pgEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { movies } from './movie';
import { users } from './auth';

export const metricKind = pgEnum('metric_kind', ['bechdel', 'unconsenting', 'ddd']);

export const communityMetricSubmissions = pgTable(
	'community_metric_submissions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		metric: metricKind('metric').notNull(),
		value: smallint('value').notNull(), // metric-scoped scale, validated in app layer
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('cms_user_movie_metric_idx').on(t.userId, t.movieId, t.metric), // resubmission = upsert
		index('cms_movie_metric_idx').on(t.movieId, t.metric), // aggregate community score
		index('cms_user_created_idx').on(t.userId, t.createdAt) // "metrics submitted" history
	]
);

export const comments = pgTable(
	'comments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		movieId: uuid('movie_id')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [
		index('comments_movie_idx').on(t.movieId, t.createdAt), // a title's thread, newest-first
		index('comments_user_idx').on(t.userId, t.createdAt) // "comment history" view, newest-first
	]
);
```

Every read these tables serve is index-covered; the `(userId, createdAt)` / `(movieId, createdAt)` composites make history/thread queries index-ordered scans (no separate sort). Ship empty.

### 3. `movie_trigger_tags.created_by` onDelete

The FK at `db/schema/movie.ts:72` has no `onDelete`. With `users` now cascade-deletable, set **`onDelete: 'set null'`** (keep the moderation tag, orphan its author) rather than cascading away curated content — apply in the same rewrite unless the user objects.

### 4. Register schema + migration

- `db/connections.ts`: `import * as communitySchema from './schema/community'` and spread into `drizzle(queryClient, { schema: { ...movieSchema, ...authSchema, ...communitySchema } })`.
- `bun run db:generate` (TTY — user runs) → **`0001_*`**. Rewriting `user` (PK semantics, dropped cols) on an FK-target table is **not purely additive**; drizzle-kit may prompt. Dev DB is disposable → squash fallback if the diff is awkward.

---

## Auth flow & provisioning (server)

### 5. `src/hooks.server.ts` — corrected rework

```ts
import { type RequestEvent, redirect, error, type Handle } from '@sveltejs/kit';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { PUBLIC_HANKO_API_URL } from '$env/static/public';
import { getOrCreateUser } from '$lib/server/data/user-queries';

// Module-level: created ONCE. jose caches keys on the set instance; re-creating per request defeats that.
const JWKS = createRemoteJWKSet(new URL(`${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`));

/** Hanko `email` claim is version-dependent: object {address,...} (newer) or string (older). Normalize both. */
function emailFromClaims(payload: JWTPayload): string | null {
	const e = (payload as Record<string, unknown>).email;
	if (typeof e === 'string') return e;
	if (e && typeof e === 'object' && 'address' in e) {
		const addr = (e as { address?: unknown }).address;
		return typeof addr === 'string' ? addr : null;
	}
	return null;
}

async function verifyClaims(event: RequestEvent): Promise<JWTPayload | null> {
	const token = event.cookies.get('hanko');
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, JWKS);
		return payload;
	} catch {
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const claims = await verifyClaims(event);

	if (claims?.sub) {
		event.locals.user = await getOrCreateUser({
			sub: claims.sub,
			email: emailFromClaims(claims)
		});
	} else {
		event.locals.user = null;
	}

	if (event.url.pathname.startsWith('/user') && !event.locals.user) {
		redirect(303, '/auth');
	}

	// Authorization is ALWAYS DB-sourced (locals.user.role) — Hanko has no concept of MIDB roles.
	if (event.url.pathname.startsWith('/user/moderation')) {
		const role = event.locals.user?.role;
		if (role !== 'moderator' && role !== 'administrator') {
			throw error(403, 'Forbidden');
		}
	}

	return resolve(event);
};
```

Fixes vs the stub: module-level JWKS (was re-created per request, defeating `jose`'s key cache); capture the payload (was discarded); defensive email extraction; centralized role gate via `error(403)`. Provisioning is one PK-keyed upsert and only runs when `claims.sub` exists. If hot-path cost shows later, cache by `sub` in `$lib/server/cache` with short TTL — **future, not now**.

### 6. `src/lib/server/data/user-queries.ts` (new)

Follow `src/lib/server/data/media-queries.ts` shape (server-only, `import db from '$db/connections'`, JSDoc, read/write split):

- **`getOrCreateUser({ sub, email }: { sub: string; email: string | null })`** → `INSERT ... ON CONFLICT (id) DO UPDATE SET email = COALESCE(excluded.email, "user".email)` returning the row. **Do NOT set `updated_at` here** — reserve it for real edits, not "last seen." `COALESCE` lets a later email backfill a null without clobbering. Default role `user`, single round-trip.
- **`getUserById(id)`** → read-only `findFirst`.
- **`updateProfile(id, { username?, avatarKey? })`** → validate first (§7); set `updated_at = now()`; catch unique-violation on `lower(username)` → `{ ok: false, reason: 'username-taken' }`, else `{ ok: true, user }`.
- **`isUsernameAvailable(username, excludingId)`** → `lower(username)` lookup for the debounced edit-form check.
- **`getUserComments(userId)` / `getUserSubmissions(userId)`** → ordered reads off `(userId, createdAt)`; submissions join `movies` for title. Return `[]` today.

Expose `UserRow = typeof users.$inferSelect` and `UserRole`; re-export **type-only** `UserRole` from `src/lib/media/types/user.ts` (mirror `src/lib/media/types/ddd.ts`) to keep `$lib/server` out of client bundles.

### 7. Input validation (server-side, authoritative — the app's first user-controlled writes)

In `updateProfile`:

- **Username format:** `^[a-z0-9_]{3,32}$`, normalized to lowercase. Blocks control chars, whitespace-only, homoglyph impersonation.
- **Reserved-name blocklist:** reject `admin`, `administrator`, `moderator`, `mod`, `midb`, `support`, `staff`, `root` (+ obvious variants).
- **`avatarKey` must exist in the avatar registry** (§9) — reject arbitrary strings; don't rely on render-time fallback to sanitize storage.
- Never put user fields through `{@html}` (Svelte auto-escapes `{username}`; keep it that way — relevant since avatars use inline SVG nearby).
- Form action is POST-only; confirm SvelteKit's default `csrf.checkOrigin` isn't disabled.

### 8. `src/app.d.ts` + root layout loader

```ts
import type { UserRow } from '$lib/server/data/user-queries';
declare global {
	namespace App {
		interface Locals {
			user: UserRow | null;
		}
		interface PageData {
			user?: UserRow | null;
		}
	}
}
export {};
```

There is **no** `src/routes/+layout.server.ts` today (only `+layout.svelte`). **Create** `src/routes/+layout.server.ts` returning `{ user: locals.user }` so navbar + profile read auth/role without refetch.

---

## Avatars (preset feminist icons)

### 9. `src/lib/components/user/avatars/` (new)

- `avatars.ts` — registry: `{ key, name, component }[]` of curated historical feminist icons (`wollstonecraft`, `pankhurst`, `truth`, `de-beauvoir`, `davis`, `kahlo`, …). `key` is what `users.avatarKey` stores **and** what §7 validates against. Names third-person, matter-of-fact.
- One `.svelte` per icon: inline `<svg>` **stylized emblematic silhouette** (not photoreal — avoids likeness concerns, matches the geometric language) using design tokens (`--brand`, `--surface`, `--ink`) so it themes. Verify tokens cascade inline at small (navbar) and large (picker) sizes.
- `Avatar.svelte` — renderer: `(avatarKey: string | null, size)` → registry lookup; **null/unknown → neutral default emblem, visually distinct from a broken/loading state**.
- `AvatarPicker.svelte` — selectable grid; reuse `src/lib/components/ui/form/radioTile.svelte` + tile/surface vocabulary; emits the chosen `key`.

`@reference` depth: components two levels under `components/user/avatars/` use four `../`.

---

## Routes (thin folders — `$lib` holds logic)

### 10. `/auth` — `src/routes/auth/+page.svelte`: change `goto("/user/dashboard")` → `goto("/user/profile")`. `<hanko-auth>` already covers sign-up + sign-in; first `/user/*` request triggers JIT provisioning.

### 11. `/user/profile` (new — the new home)

- `+page.server.ts`: load returns `locals.user`; `?/updateProfile` form action calls `updateProfile`, surfaces `username-taken` + format/blocklist rejections as field errors.
- `+page.svelte`: header (Avatar + username or **"Set a username"** prompt + email + role badge), edit affordance (username field + `AvatarPicker`), **debounced inline availability** via `isUsernameAvailable`. Links to `/user/dashboard` and the history views.

### 12. `/user/dashboard` — keep `<hanko-profile>`; relabel "home" → "account settings"; link from profile.

### 13. `/user/comments` + `/user/metrics` (new)

- `comments/+page.server.ts` → `getUserComments(locals.user.id)`; list + empty state "No comments yet." Reuse `movies/sections` card vocabulary; rows link to the title.
- `metrics/+page.server.ts` → `getUserSubmissions(locals.user.id)`; values per title; empty today. Same vocabulary. Both gated by the existing `/user/*` hook.

### 14. Navbar — `src/lib/components/layout/navbar.svelte` (there is **no** `navbarMenu.svelte`). When `data.user`: swap "Sign in" for `Avatar` + link to `/user/profile` + logout (reuse `src/lib/components/auth/logoutButton.svelte`). **Define unset-username fallback** (email local-part, else "Account"). Show "Moderation" only for `moderator`/`administrator`.

---

## Role seeding

### 15. `db/scripts/seedAdmin.ts` + `db:seed:admin`

`bun run db:seed:admin <email>` → `UPDATE "user" SET role='administrator' WHERE lower(email)=lower($1)` (case-insensitive). Idempotent; **print the matched email** or "no row matched — user must sign in first." Add to `package.json` next to `db:seed:*`.

---

## Docs — `.CLAUDE/architecture.md`

New "User & roles" subsection (Hanko-sub PK, role enum, profile fields, community tables + index rationale); update **Auth flow (Hanko)** (JIT provision, `locals.user`, DB-sourced role gate, profile-vs-dashboard split); **Routes** table; **Component library** (`user/` + `user/avatars/`); **Migrations** (`0001`), **npm scripts** (`db:seed:admin`), **Known gaps** (community tables exist but unwritten; submission write path is remaining milestone). No new secrets.

---

## Implementation tips for Sonnet

Read these before you start — they encode the gotchas that cost time on this codebase.

1. **Decode a real Hanko token first.** Don't trust the `email` happy path until you've seen this tenant's actual payload. Sign up against `https://9c6919b1-58ec-4f71-bd6c-c2941b2d6008.hanko.io`, copy the `hanko` cookie, paste into jwt.io (or `jose` decode). If `email` is an object, the `emailFromClaims` object branch is your happy path; if a string, the string branch. The code handles both either way — this is just to know which path runs.
2. **`bun run db:generate` needs a TTY.** It can prompt interactively (renaming vs drop+create columns) — you cannot answer prompts. Flag it for the user to run, then review the emitted SQL. If the diff for the `user` rewrite is ugly, the dev DB is disposable: squash to a clean `0001` rather than fighting drizzle-kit.
3. **`bun run db:migrate` is mandatory and separate.** Boot does NOT migrate (commit `742c612`). After generating, run migrate explicitly before `bun run dev`, or you'll hit "relation does not exist."
4. **Order of work:** schema (`auth.ts` + `community.ts`) → `connections.ts` → generate/migrate → `user-queries.ts` → `app.d.ts` + `+layout.server.ts` → `hooks.server.ts` → avatars → routes → navbar → seed script → docs. Each later step typechecks against the earlier ones; doing hooks before `user-queries` exists just breaks `bun run check`.
5. **Keep `$lib/server` out of the client.** The whole point of `media/types/user.ts` re-exporting `UserRole` **type-only** is that importing `user-queries.ts` (which imports `$db`) into a `.svelte` component leaks the DB into the client bundle and `bun run build` will fail or balloon. Components import the type from `media/types/user.ts`; only `+page.server.ts` / hooks import `user-queries.ts`.
6. **Don't bump `updated_at` on provisioning.** It runs on (nearly) every authed request. If the upsert touches `updated_at`, every page view dirties the row + churns indexes and the column becomes meaningless. `COALESCE` email only; leave timestamps alone except in `updateProfile`.
7. **Username uniqueness is case-insensitive by index, validation is case-insensitive too.** Normalize to lowercase in `updateProfile` before both the format check and the write, so the `lower(username)` unique index and your app logic agree. The unique-violation catch is your race-condition backstop (two users submitting the same name simultaneously) — keep it even with the pre-check.
8. **Validate `avatarKey` against the registry on write, not just render.** Import the registry keys into `updateProfile`. The render-time fallback is for _display_ robustness, not input sanitization.
9. **Match the surrounding code.** `user-queries.ts` should read like `media-queries.ts` (same JSDoc density, `import db from '$db/connections'`, read/write split). Avatars/history cards reuse `ui/form/radioTile.svelte` and the existing tile/surface vocabulary — don't invent new styling.
10. **There is no `navbarMenu.svelte`.** Edit `navbar.svelte` only. And there's no `src/lib/server/data/__tests__/` dir yet — check where an existing vitest spec lives and follow that convention (co-located `*.test.ts` vs `__tests__/`) before placing the new spec.
11. **Role checks read `locals.user.role` (DB), never a JWT claim.** Hanko doesn't know your roles. Any authorization decision sources from the DB row.

---

## Critical files

| File                                                      | Change                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `db/schema/auth.ts`                                       | Rewrite `users`: Hanko-sub PK, role enum, **nullable** email, username/avatarKey, `lower(username)` unique idx, drop Auth.js cols |
| `db/schema/movie.ts`                                      | `created_by` FK → add `onDelete: 'set null'`                                                                                      |
| `db/schema/community.ts`                                  | **New** — submissions + comments (empty, `(userId,createdAt)` indexes)                                                            |
| `db/connections.ts`                                       | Register `communitySchema`                                                                                                        |
| `db/migrations/0001_*`                                    | Generated (TTY; may prompt — dev DB disposable)                                                                                   |
| `db/scripts/seedAdmin.ts`                                 | **New** — case-insensitive promote by email                                                                                       |
| `src/hooks.server.ts`                                     | Module-level JWKS, capture payload, defensive email extract, JIT provision, populate `locals.user`, `error(403)` role gate        |
| `src/app.d.ts`                                            | Type `App.Locals.user` / `App.PageData.user`                                                                                      |
| `src/routes/+layout.server.ts`                            | **New** — expose `locals.user`                                                                                                    |
| `src/lib/server/data/user-queries.ts`                     | **New** — provision (no updated_at on read) / profile (validation) / history                                                      |
| `src/lib/media/types/user.ts`                             | **New** — type-only `UserRole` re-export                                                                                          |
| `src/lib/components/user/avatars/*`                       | **New** — registry, per-icon SVGs, `Avatar`, `AvatarPicker`                                                                       |
| `src/routes/auth/+page.svelte`                            | Redirect → `/user/profile`                                                                                                        |
| `src/routes/user/profile/*`                               | **New** — view + edit action + inline availability check                                                                          |
| `src/routes/user/comments/*`, `src/routes/user/metrics/*` | **New** — history views                                                                                                           |
| `src/routes/user/dashboard/*`                             | Demote to Hanko account settings                                                                                                  |
| `src/lib/components/layout/navbar.svelte`                 | Auth/role-aware; unset-username fallback label                                                                                    |
| `package.json`                                            | `db:seed:admin` script                                                                                                            |
| `.CLAUDE/architecture.md`                                 | Document all of the above                                                                                                         |

## Reused patterns

- `src/lib/server/data/media-queries.ts` data-layer shape → `user-queries.ts`.
- `src/lib/media/types/ddd.ts` type-only client boundary → `media/types/user.ts`.
- `src/lib/components/ui/form/radioTile.svelte` + tile/surface vocabulary → `AvatarPicker` + history cards.
- Existing `jose` verify in `hooks.server.ts` → extended (module-level JWKS + payload capture).
- `logoutButton.svelte`, `<hanko-auth>`, `<hanko-profile>` reused unchanged.

---

## Verification

1. **Decode a real Hanko token** — confirm `email` shape matches `emailFromClaims`.
2. **`bun run db:generate`** (TTY) → `0001_*`. Review SQL: two enums, rewritten `user` with `lower(username)` unique idx, `created_by` set-null, two community tables with named indexes.
3. **`bun run db:migrate`** (explicit — boot does NOT migrate since `742c612`).
4. **`bun run check`** → 0 errors.
5. **`bun run test:unit`** → green; add a `user-queries` spec for (a) provisioning idempotency, (b) null/object/string email claim, (c) case-insensitive username collision, (d) format/blocklist/invalid-avatarKey rejection, (e) provisioning does **not** bump `updated_at`. Place per the repo's existing vitest convention (check an existing spec first).
6. **`bun run build`** → clean (no `$lib/server` leak via the type boundary).
7. **Manual E2E** (`bun run dev`):
   - Sign up via `/auth` → lands on `/user/profile`; `user` row JIT-created (role `user`); header shows username prompt + default avatar + email (graceful blank if claim absent).
   - Set username + avatar → persists; reload reflects; navbar shows avatar. Taken username (case variant too) → friendly error. Reserved/invalid-format → rejected. Inline availability fires while typing.
   - `/user/comments`, `/user/metrics` → empty states render.
   - `bun run db:seed:admin <your-email>` → reload → administrator badge + "Moderation" nav; `/user/moderation` returns 403 for a `user` account.
   - Logout → `/user/*` redirects to `/auth`.

## Sources consulted

- Hanko session JWT default claims (`sub`, `email`, `username`, `session_id`, `aud`, `exp`, `iat`): https://docs.hanko.io/guides/session-management
- JWT usage discussion: https://github.com/teamhanko/hanko/discussions/246
- Tenant JWKS verified reachable: `https://9c6919b1-58ec-4f71-bd6c-c2941b2d6008.hanko.io/.well-known/jwks.json`
