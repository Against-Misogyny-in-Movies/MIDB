# Third-party notices

`LICENSE` (Apache-2.0) covers this project's own code and documentation, not the material below.

## Data sources

Each source keeps the rights to its data. MIDB copies Bechdel Test and Unconsenting Media data daily, shows it with attribution and a link to the source's page, and never changes a source's values (`.claude/rules/authority.md`).

| Source                                                  | Used for                                                                                                                 | Terms                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Bechdel Test Movie List](https://bechdeltest.com)      | Bechdel Test ratings, and the film list (title, year, IMDb id)                                                           | The list and ratings are licensed [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/). Comments on bechdeltest.com belong to their authors and are not used. |
| [Unconsenting Media](https://www.unconsentingmedia.org) | Sexual violence flags and descriptions                                                                                   | No licence is published; the data is used as published, with attribution.                                                                                                |
| [Does the Dog Die](https://www.doesthedogdie.com)       | Content warnings                                                                                                         | Fetched through its API with an API key, under its terms.                                                                                                                |
| [Anthropic](https://www.anthropic.com) (Claude API)     | Automatic moderation of comments: the comment text, the title's name and the parent comment are sent to Claude Haiku 5.5 | Used through the API with an API key, under Anthropic's terms. The email and account of the author are never sent.                                                       |
| [TMDB](https://www.themoviedb.org)                      | Titles, posters, cast and crew, popularity, from TMDB's daily id exports                                                 | This product uses the TMDB API but is not endorsed or certified by TMDB. Posters are fetched from TMDB's image server and served from MIDB's own origin.                 |

## Fonts and icons

- **Inter Tight:** [SIL Open Font License 1.1](https://openfontlicense.org), latin, latin-ext and vietnamese 600 and 700 woff2 files from the `@fontsource/inter-tight` package, copyright 2022 The Inter Project Authors, served from `static/fonts` with the license text in `static/fonts/OFL.txt`.
- **Remixicon:** [Apache-2.0](https://github.com/Remix-Design/RemixIcon/blob/master/License), bundled from the `remixicon` package.

## Sign-in

[Better Auth](https://www.better-auth.com) (`better-auth`, `@better-auth/passkey`, MIT) runs the accounts, sessions and passkeys inside MIDB's own Worker and database, and keeps its own licence. Google and Discord are used for sign-in only where a reader chooses them, under their terms; Cloudflare Turnstile guards creating an account with a passkey.

## Hosting

The site runs on [Cloudflare Workers](https://workers.cloudflare.com), under Cloudflare's terms. Wrangler and `@sveltejs/adapter-cloudflare` build and run it locally and keep their own licences.

[Anthropic](https://www.anthropic.com) receives comment text for moderation through its API (`@anthropic-ai/sdk`, Apache-2.0), under Anthropic's terms.

## Dependencies

Package dependencies keep their own licences, in each package under `node_modules/`.
