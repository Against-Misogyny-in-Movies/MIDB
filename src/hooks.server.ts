import { type RequestEvent, redirect, error, type Handle } from "@sveltejs/kit";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { PUBLIC_HANKO_API_URL } from "$env/static/public";
import { getOrCreateUser } from "$lib/server/data/user-queries";

// Module-level: created once. jose caches keys on the set instance; re-creating per request defeats that.
const JWKS = createRemoteJWKSet(
	new URL(`${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`)
);

/** Hanko `email` claim is version-dependent: object {address,...} (newer) or string (older). Normalize both. */
function emailFromClaims(payload: JWTPayload): string | null {
	const e = (payload as Record<string, unknown>).email;
	if (typeof e === "string") return e;
	if (e && typeof e === "object" && "address" in e) {
		const addr = (e as { address?: unknown }).address;
		return typeof addr === "string" ? addr : null;
	}
	return null;
}

async function verifyClaims(event: RequestEvent): Promise<JWTPayload | null> {
	const token = event.cookies.get("hanko");
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, JWKS);
		return payload;
	} catch {
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const claims = await verifyClaims(event);

	if (claims?.sub) {
		event.locals.user = await getOrCreateUser({
			sub: claims.sub,
			email: emailFromClaims(claims),
		});
	} else {
		event.locals.user = null;
	}

	if (event.url.pathname.startsWith("/user") && !event.locals.user) {
		redirect(303, "/auth");
	}

	// Authorization is always DB-sourced (locals.user.role) — Hanko has no concept of MIDB roles.
	if (event.url.pathname.startsWith("/user/moderation")) {
		const role = event.locals.user?.role;
		if (role !== "moderator" && role !== "administrator") {
			throw error(403, "Forbidden");
		}
	}

	return resolve(event);
};
