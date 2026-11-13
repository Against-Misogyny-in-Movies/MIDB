/** Path of an account's public profile; undefined when the account has no username to route by. */
export function profileHref(username: string | null | undefined): string | undefined {
	return username ? `/u/${username}` : undefined;
}
