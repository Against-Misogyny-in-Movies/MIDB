# Plan: profile and settings

A proposal, not yet approved. No phase is in `docs/phases/STATUS.md` until the user approves it.

Scope set by the user (2026-11-17):

- Settings gains account deletion, a data download, active sessions, and other useful additions.
- The profile gains contribution stats and no free-text fields.
- Username and avatar editing stay inline on `/u/<username>`; security stays on `/user/settings`.
- Settings stays one page of sections.

## Job and audience

Both surfaces are Operate (`PRODUCT.md`, Surfaces). A reader reaches settings a few times a year, to add or remove a sign-in method, to check where the account is signed in, or to leave. A reader reaches a profile from a name on a comment, to judge who wrote it. Many read on a phone. Some use MIDB because of their own safety, so what the account exposes and how to leave must be plain.

## What the research says

1. **Group by what the reader came to do, in one page while the settings are few.** Sub-pages and a sidebar pay off past about twenty settings. GitHub and Linear split because they have hundreds.
2. **One save pattern per page.** Primer's saving pattern: never mix a page-level Save with controls that save at once. Every settings control here acts at once, with its own confirmation and toast.
3. **Passkeys get one list under one heading, and removal states its effect.** FIDO Alliance design guidelines: passkeys are a primary item in account settings, and the removal text says the passkey can no longer sign in. Google's passkey guidance: show where a passkey lives so the reader can tell the rows apart.
4. **Destructive actions sit apart, at the foot, and explain themselves.** The section says what is removed, what stays and whether it can be undone; red styling alone tells the reader nothing. Confirmation is typed, and the session is recent.
5. **Leaving is self-serve, with the export beside it.** GDPR articles 17 and 20 are the anchors. A flow that sends the reader to a contact form draws complaints.
6. **One profile component for owner and visitor.** The owner's extras are added to the visitor's page; they do not replace it.
7. **A profile is never blank.** Every account already has a generated username and a default avatar; empty lists say where content comes from.

Sources: Primer, Saving (`primer.style/ui-patterns/saving`); FIDO Alliance Design Guidelines (`fidoalliance.org/design-guidelines`); Google, Passkeys user journeys (`developers.google.com/identity/passkeys/ux/user-journeys`); Smashing Magazine, How to manage dangerous actions in user interfaces (2024); SaaSFrame, Settings page design examples; UXmatters, The offboarding user experience (2020). Reference products: GitHub (settings sections, sessions list, danger zone), Letterboxd (profile as stats over activity), Discord (devices list).

## Findings in the current pages

Read from code. Neither page was rendered for this plan.

### Settings (`src/routes/user/settings/`)

- **S1. No way to delete an account.** `PRIVACY.md` mentions a deleted account, and no page or endpoint deletes one.
- **S2. No data download.**
- **S3. Sessions are stored and never shown.** Each session keeps an IP address and a browser (`PRIVACY.md`, Signing in). The reader cannot see them or end one.
- **S4. The page is blank until its script runs.** `ssr = false`, then "Loading…", then the list and the add buttons arrive and move.
- **S5. A single sign-in method is a silent risk.** There is no email recovery, so an account with one passkey is lost with the device. The page mentions it only as the reason Remove is disabled.
- **S6. Two names for one thing.** The heading says "Accounts and passkeys"; the hints, `PRODUCT.md` and `SECURITY.md` say "sign-in methods".
- **S7. Passkey rows cannot be told apart.** The row shows a label and a date. The database also holds whether the passkey is synced (`backed_up`), and the row does not show it.
- **S8. The email card does not say where the email comes from** or that MIDB has no field to change it.
- **S9. The page file mixes the page, the methods list and its styles** in one 387-line component.

### Profile (`src/routes/u/[username]/`)

- **P1. The owner's view replaces the list after paint.** The rows swap and the tab counts change (`docs/phases/STATUS.md`, Open items, Profile).
- **P2. The community reports list is sent whole.** `getProfileReports` has no limit, so the cached page grows with the account. Comments page.
- **P3. The header carries one number.** "Comment score" stands alone; the counts sit on the tabs.
- **P4. The owner cannot see the page as a visitor does** once the owner's view has loaded.

## Selected direction

Inside the existing visual system (`DESIGN.md`): cards, hairline rows, plates, `Notice`, toasts. No new tokens, no new primitives.

### Settings: one page, six sections, every action immediate

A 36rem column of cards under the title row, with the Methodology page's "On this page" list beside it from the width where it fits.

```
Settings                                   [Sign out]
[avatar] ada_1234 · View profile

Email
  ada@example.org
  From the linked Google account. Not shown on the profile or on comments.

Sign-in methods
  ! One sign-in method. If it is lost, the account cannot be recovered.
  G  Google            Added 02/11/2026            [Remove]
  ◉  MacBook           Synced · Added 02/11/2026   [Rename] [Delete]
  [Add a passkey] [Link Discord]

Sessions
  Firefox on macOS     This device · Since 14/11/2026
  Safari on iPhone     Since 03/11/2026            [Sign out]
  [Sign out everywhere else]

Appearance
  Theme   ( System | Light | Dark )

Account data
  Comments, community reports, votes and account details as a JSON file.
  [Download data]

Delete account
  What is removed, what stays.
  [Delete account…]
```

- **Order.** By how often it is used, with the irreversible action last and apart.
- **Identity line.** Avatar, username and a link to the profile replace the bare "Profile" back link, so the page says whose settings these are.
- **First paint.** The server renders the title, the identity line, the email and every section heading. The methods and sessions cards hold fixed-height skeleton rows with `aria-busy`, and the add buttons are in place and disabled until the list loads. Nothing below a card moves.
- **Sign-in methods.** The heading takes the term the rest of the site uses. A synced passkey says "Synced"; one that is not says "This device only". With one method, a `warn` `Notice` at the top of the card says the account cannot be recovered if the method is lost, and the add buttons follow.
- **Sessions.** One row per session: browser and operating system read from the stored user agent, the day it started, and "This device" as a `Badge` on the current one. Sign out per row, and "Sign out everywhere else" under the list, each with the plate confirmation the methods card uses. No location: that would need a third party.
- **Appearance.** Three choices, with System added to the two the navbar toggle has. The toggle and this control share one module.
- **Account data.** One button. The file downloads; a toast confirms.
- **Delete account.** The card states the effect in a short list (below). The button opens a plate: a link to Download data, a field to type the username, and "Delete account" in ink with "Keep the account" in ghost. A session older than the limit asks the reader to sign in again first. On success the reader lands on `/` signed out, with a toast.

### What deleting an account does

| Data                                          | Result                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Email, linked accounts, passkeys, sessions    | Deleted.                                                                                         |
| Username, avatar                              | Removed. The profile address is a 404. The username stays unavailable for the retired-name wait. |
| Comments with no replies                      | Deleted.                                                                                         |
| Comments with replies                         | Text erased; the placeholder with no text and no author keeps the thread.                        |
| Community reports, votes, reports of comments | Deleted. Title counts are recounted.                                                             |
| Moderation log entries about the account      | Kept, no longer naming it.                                                                       |

How it is built:

- **A scrubbed row, not a row delete.** `comments.user_id` cascades and replies cascade from their parent, so deleting the `user` row would delete other readers' replies. The action keeps the row with no personal data and a new nullable `deleted_at`, in one `db.batch()`. The migration is additive.
- **A deleted account reads like a banned one:** `locals.getUser()` is null, `findProfileOwner` finds nothing, and no session starts.
- **Guards.** `requireUser`, a recent session, the typed username checked on the server, a rate limit, and a refusal for the last administrator.
- **Purges.** The profile tag and every title whose comment list or counts changed, chunked.

### Profile: stats in the header, owner extras added in place

```
[avatar]  ada_1234                          [Edit profile] [Settings]
          Moderator · Joined 02/11/2026

  Comment score   Comments   Community reports   Titles
       42            17             9              21

[Comments] [Community reports] [Not public 3]      (owner only)
┌ rows …
```

- **Stat row.** Four figures in the stat-line pattern, `tabular-nums`, two columns on a phone and four from the wider breakpoint. "Titles" is the number of distinct films and series the account's published comments and counted reports are on. The tabs drop their counts, so each number is said once.
- **Owner extras are additive (fixes P1).** The Comments and Community reports tabs always show the public lists, for the owner too. The owner's rows gain their edit and delete menu in a slot every row already reserves. A third tab, "Not public", appears for the owner with the comments awaiting review, rejected or deleted and the reports held or rejected, each with its status `Badge`. The tab row has a fixed height, so its arrival moves nothing. This also answers P4: the owner sees the visitor's page by default.
- **Reports page like comments (fixes P2).** The first page in the cached load, "Show more community reports" from an endpoint under the same tag.
- **Editing.** Unchanged: the inline editor under the header.

## Scope and boundaries

- **Untouched:** the sign-in page, moderation, the avatar set, the username rules, the editor's behaviour, the cache policy of `/u/<username>` (`PUBLIC_PAGE`, no user read in the load).
- **Not in this plan:** a bio or pronouns, following, email notifications (MIDB sends no email), blocking an account, reporting a username. The last two suit this audience and deserve their own plan.
- **Anti-goals:** no red danger card, no page-level Save, no settings sub-routes, no geolocated sessions, no new dependency (the user-agent reader is a small local function).

## States

- **Settings:** loading (skeleton rows), load failed (`Notice` with the reload line, per card), one method (warn `Notice`), one session (no "Sign out everywhere else"), no email (the current line), an action running (the busy button), a refused delete (wrong username in the field's error line; a stale session as a `Notice` with a sign-in link).
- **Profile:** a visitor, the owner before and after the private load, the owner with nothing unpublished (no third tab), a muted owner (the current `Notice`), a failed private load (the current `Notice`), zero in every stat.
- **Ranges:** one to about ten sign-in methods and sessions; a username up to its maximum length wrapping in the identity line; stats up to five digits.

## Phases

Each phase ends green on the verification baseline (`.claude/rules/code-standards.md`, Checking a change), then `reviewer`, with `ux` and `copy-judge` where the agents file calls for them.

| Phase | Work                                                                                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1    | Settings structure: server-rendered shell, identity line, sections, "On this page", skeleton rows; the methods card moves to `user/signInMethodsCard`; S5–S8 copy and states. |
| A2    | Sessions: list, sign out one, sign out the others; the user-agent reader in `#lib/media/utils/`.                                                                              |
| A3    | Appearance: the shared theme module and the three-way control.                                                                                                                |
| A4    | Account data: `GET /api/me/export`, `private, no-store`, rate-limited, with its `*.db.spec.ts`.                                                                               |
| A5    | Delete account, data: `deleted_at`, the scrub batch, the guards, the purges, the deleted-account reads.                                                                       |
| A6    | Delete account, page: the card, the plate, the redirect and toast.                                                                                                            |
| B1    | Profile data: the Titles figure, paged reports, the split of the owner's rows into public and not public.                                                                     |
| B2    | Profile page: the stat row, the additive owner view, the third tab.                                                                                                           |
| D1    | Docs and copy: `PRIVACY.md`, `SECURITY.md`, `DESIGN.md`, `PRODUCT.md`, `docs/architecture.md`, the open items this closes.                                                    |

A and B are independent. A5 ships a deploy before A6, so the Worker that knows `deleted_at` is live before any account can be deleted.

## Open decisions

1. **Deletion is immediate.** Recommended: yes, with no grace period. A passkey-only account has no email to send a reminder to, and D1 Time Travel already keeps the database recoverable for its window. The alternative is a cancellable wait of some days, during which the account is hidden and signing in cancels.
2. **Erasing the text of comments that have replies.** Recommended: erase, as in the table. The alternative keeps the text under "Deleted account", which is less than a reader asking to leave expects.
3. **A session ends at once.** Better Auth's cookie cache lets a signed-out session read as valid for its cache time (`create-auth.ts`). Recommended: the sessions card says so in one line. The alternative shortens or drops the cache, which costs a database read per request.
4. **The export's contents.** Recommended: profile fields, email, sign-in method labels and dates (no keys), sessions, comments in every status with the reason for a rejection, community reports with their answers, votes, and reports the account made. Not included: which moderator acted.
5. **Sessions show the IP address.** Recommended: no, browser and day only; the export carries it.
