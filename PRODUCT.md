# Product

MIDB shows movies and TV series through a content-safety and representation lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media flags and Does the Dog Die trigger warnings, and summarises them in two verdicts: content safety and representation of women. Readers who watched a title add community reports on violence against women and sexual objectification, which fill gaps the sources leave and are shown as counts beside the verdicts.

## Audience

People deciding whether to watch something, often right before watching, often on a phone. Some are avoiding sexual violence for their own safety; some are choosing films with women on screen and behind the camera. They want the answer quickly and the evidence close by.

## Surfaces

- `/` landing: what MIDB is, a search field, what it checks. (Persuade, quiet.)
- `/movie/[id]`, `/tv/[id]`: the title reference. (Read / Operate.)
- `/resources`: how each metric works. (Read.)
- MIDB community reports on `/movie/[id]` and `/tv/[id]`: a section after Unconsenting Media shows counts of what readers report, and a signed-in reader adds, edits or deletes their own report and can flag a title's counts as wrong. Reports never change a verdict. (Read / Operate.)
- Comments on `/movie/[id]` and `/tv/[id]`: readers discuss a title. A comment is reviewed before others see it; its author sees its status. (Operate.)
- `/user/comments`: an account's own comments with their status. (Operate.)
- `/user/metrics`: an account's own community reports with their status. (Operate.)
- `/user/moderation`: moderators and administrators review pending and reported comments, community reports held for review and titles whose counts readers flagged, mute or ban an account, and read the action log. (Operate.)
- `/auth`, `/user/*`: account. Readers sign in with a passkey, Google or Discord; there are no passwords. (Operate.)
- Source freshness: a metric section shows when its source last synced ("Updated <date>"). A daily job refreshes the Bechdel Test, Unconsenting Media and TMDB popularity data, and moderators see a warning when a source is stale. (Read.)

## Commitments

- Privacy first: no trackers, analytics or ad pixels.
- Open source, community funded.
- Copy is matter-of-fact, third person, essentials only, no slogans, no em dashes (`.claude/rules/copy-standards.md`).
- Claims are code-backed: copy that describes scoring mirrors `verdict.ts`.
- The brand colour is the existing violet.
