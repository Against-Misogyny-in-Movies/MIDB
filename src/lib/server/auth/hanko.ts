import type { RequestEvent } from '@sveltejs/kit';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { PUBLIC_HANKO_API_URL } from '$env/static/public';

// Module-level: created once. jose caches keys on the set instance; re-creating per request defeats that.
const JWKS = createRemoteJWKSet(new URL(`${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`));

/** Hanko `email` claim is version-dependent: object {address,...} (newer) or string (older). Normalize both. */
export function emailFromClaims(payload: JWTPayload): string | null {
	const e = (payload as Record<string, unknown>).email;
	if (typeof e === 'string') return e;
	if (e && typeof e === 'object' && 'address' in e) {
		const addr = (e as { address?: unknown }).address;
		return typeof addr === 'string' ? addr : null;
	}
	return null;
}

export async function verifyClaims(event: RequestEvent): Promise<JWTPayload | null> {
	const token = event.cookies.get('hanko');
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, JWKS);
		return payload;
	} catch {
		return null;
	}
}
