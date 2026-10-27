# Product

MIDB shows movies and TV series through a content-safety and representation lens. Each title page combines live TMDB data with the Bechdel Test, Unconsenting Media flags and Does the Dog Die trigger warnings, and summarises them in two verdicts: content safety and representation of women.

## Audience

People deciding whether to watch something, often right before watching, often on a phone. Some are avoiding sexual violence for their own safety; some are choosing films with women on screen and behind the camera. They want the answer quickly and the evidence close by.

## Surfaces

- `/` landing: what MIDB is, a search field, what it checks. (Persuade, quiet.)
- `/movie/[id]`, `/tv/[id]`: the title reference. (Read / Operate.)
- `/resources`: how each metric works. (Read.)
- `/user/*`, `/auth`: account. (Operate.)

## Commitments

- Privacy first: no trackers, analytics or ad pixels.
- Open source, community funded.
- Copy is matter-of-fact, third person, essentials only, no slogans, no em dashes (see `AGENTS.md`).
- Claims are code-backed: copy that describes scoring mirrors `verdict.ts`.
- The brand colour is the existing violet.
