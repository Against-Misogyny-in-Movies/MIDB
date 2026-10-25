/**
 * Longest search query, in UTF-16 code units (what `maxlength` and `String#slice` count).
 * The search inputs stop typing/pasting at it, and `/api/search` truncates anything longer
 * before it reaches the cache or TMDB.
 */
export const SEARCH_QUERY_MAX_LENGTH = 120;
