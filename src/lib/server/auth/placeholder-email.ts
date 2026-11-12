/**
 * A passkey-only account has no email, but Better Auth requires a unique one, so it gets
 * `<id>@users.invalid`. `.invalid` is reserved (RFC 2606) and never resolves, so nothing is
 * ever sent to it. The placeholder is hidden from the UI by `realEmail`.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'users.invalid';

export function placeholderEmail(userId: string): string {
	return `${userId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
	return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/** The account's real email, or null when it only has the placeholder. */
export function realEmail(user: { email: string }): string | null {
	return isPlaceholderEmail(user.email) ? null : user.email;
}
