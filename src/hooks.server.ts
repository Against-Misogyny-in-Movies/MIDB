import { type RequestEvent, redirect, type Handle } from "@sveltejs/kit";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { PUBLIC_HANKO_API_URL } from "$env/static/public";
import { migrateDatabase } from "$db/connections";

// Run pending migrations once when the server process starts. This module's top level
// executes a single time per server boot, and Drizzle's migrate() skips already-applied
// migrations, so this is idempotent and safe to run on every startup. A failure here
// means the DB is in an unknown state, so we surface it loudly rather than serve traffic
// against an unmigrated schema.
const migrationsApplied = migrateDatabase().catch((err) => {
  console.error("[startup] database migration failed", err);
  throw err;
});

const authenticatedUser = async (event: RequestEvent) => {
  const { cookies } = event;
  const hanko = cookies.get("hanko");
  const JWKS = createRemoteJWKSet(
    new URL(`${PUBLIC_HANKO_API_URL}/.well-known/jwks.json`)
  );

  try {
    await jwtVerify(hanko ?? "", JWKS);
    return true;
  } catch {
    return false;
  }
};

export const handle: Handle = async ({ event, resolve }) => {
  // Gate the first requests on migrations finishing; resolves instantly thereafter.
  await migrationsApplied;

  const verified = await authenticatedUser(event);

  if (event.url.pathname.startsWith("/user") && !verified) {
    redirect(303, "/auth");
  }

  const response = await resolve(event);
  return response;
};
