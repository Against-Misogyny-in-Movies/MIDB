# Plan: one profile page

The account page (`/user/profile`) and the public profile (`/u/[username]`) become one page, option A of the proposals (user instruction, 2026-11-14). The owner sees the page visitors see, plus their own editing and private rows. Account security moves to one settings page.

## Decisions

- `/u/[username]` is the profile for everyone. It stays `PUBLIC_PAGE` and cookie-blind: the owner's extras load in the browser from `GET /api/me/profile` once the client session says the reader owns the page.
- The header holds the avatar, the username, the staff badge and three facts: Joined, Comment score, Counted reports. The owner also gets Edit profile and Settings.
- Edit profile opens the username and avatar form in place of the header. A changed username shows the rename warning (the old address stops working; the wait before the next change) before Save. The form posts to `/user/profile?/updateProfile`; a rename moves the page to the new address.
- Two tabs, Comments and Community reports, each with its count. `#reports` opens the second.
  - A visitor sees published comments and counted reports.
  - The owner sees every comment in every status, with edit and delete (`commentHistoryRow`), and every community report with its standing; a muted account sees the mute notice.
- `/user/settings` holds Email, Sign-in methods and Sign out. `/user/security` redirects there, keeping its query.
- `/user/profile` redirects to the reader's `/u/<username>`; it keeps the `updateProfile` action and the availability endpoint. `/user/comments` and `/user/metrics` redirect to the profile and its `#reports` tab.

## Phases

- **P1 Profile data.** `commentCount` on `PublicProfile`; `GET /api/me/profile` (comments, reports with their standing, mute) with its specs.
- **P2 Profile page.** The header, the editor, the tabs and the owner state, with specs; the redirects of `/user/profile`, `/user/comments` and `/user/metrics`.
- **P3 Settings and docs.** `/user/settings`, the `/user/security` redirect, the navbar menu's Settings link, `DESIGN.md`, `docs/architecture.md` and `PRIVACY.md` if anything new is sent.
