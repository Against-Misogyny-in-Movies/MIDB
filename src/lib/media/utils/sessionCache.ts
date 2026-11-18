/**
 * How long the signed `session_data` cookie lets a request skip the session lookup
 * (`session.cookieCache` in `#lib/server/auth/create-auth.ts`). A session ended elsewhere can
 * keep working on its device for this long, which the Sessions card says.
 */
export const SESSION_COOKIE_CACHE_SECONDS = 300;
