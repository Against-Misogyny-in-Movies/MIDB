import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { passkey } from '@better-auth/passkey';
import { sql } from 'drizzle-orm';
import type { Db } from '#db/client.ts';
import { accounts, passkeys, sessions, users, verifications } from '#db/schema/auth.ts';
import { isLocalOrigin } from '#lib/server/http/origin.ts';
import { adoptProviderEmail } from './link-email.ts';
import { guardLastMethod } from './last-method.ts';
import { guardPasskeySignUp } from './turnstile.ts';
import { createPasskeyUser, resolveNewPasskeyUser } from './passkey-signup.ts';
import { generateUsername } from './generate-username.ts';

export type OAuthCredentials = { clientId: string; clientSecret: string };

export interface AuthConfig {
	db: Db;
	/** The site's origin (`PUBLIC_ORIGIN`): the base URL, the one trusted origin and the passkey RP id's host. */
	origin: string;
	/**
	 * `BETTER_AUTH_SECRET`. Only a localhost origin may go without it (Better Auth then signs
	 * with its public default); anywhere else `createAuth` refuses to start.
	 */
	secret?: string;
	/** Each provider is enabled only when its credentials are set. */
	google?: OAuthCredentials;
	discord?: OAuthCredentials;
	/** `TURNSTILE_SECRET_KEY`: enables the Turnstile check on a passkey sign-up (no session). */
	turnstileSecret?: string;
}

/**
 * Builds the Better Auth instance (`#lib/server/auth/auth.ts` memoises it). It takes its
 * settings as arguments, so a spec can build one over a test database without the Worker's
 * env.
 */
export function createAuth({ db, origin, secret, google, discord, turnstileSecret }: AuthConfig) {
	// Better Auth's own check keys on `NODE_ENV`, which a Worker does not set, so without this a
	// deployment missing the secret would sign its cookies with the library's public default.
	if (!secret && !isLocalOrigin(origin)) {
		throw new Error('BETTER_AUTH_SECRET is not set. Set it with `wrangler secret put`.');
	}

	const socialProviders = {
		...(google && { google: { clientId: google.clientId, clientSecret: google.clientSecret } }),
		...(discord && { discord: { clientId: discord.clientId, clientSecret: discord.clientSecret } })
	};

	return betterAuth({
		appName: 'MIDB',
		baseURL: origin,
		secret,
		trustedOrigins: [origin],
		// Off explicitly: nothing is sent to Better Auth's telemetry endpoint.
		telemetry: { enabled: false },
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: {
				user: users,
				session: sessions,
				account: accounts,
				verification: verifications,
				passkey: passkeys
			}
		}),
		user: {
			additionalFields: {
				role: { type: 'string', required: false, input: false },
				username: { type: 'string', required: false, input: false },
				avatarKey: { type: 'string', required: false, input: false }
			}
		},
		session: {
			// The signed cookie lets `getSession` skip the database for five minutes after Better
			// Auth sets it. The hook's own session read cannot set cookies, so it never renews the
			// cookie. It re-reads the user row (`locals.getUser`), so a ban or a role change applies
			// at once.
			cookieCache: { enabled: true, maxAge: 300 }
		},
		account: {
			accountLinking: {
				enabled: true,
				// Only Google: a Discord sign-in links to an existing user only when Discord reports
				// the email as verified.
				trustedProviders: ['google'],
				// A passkey-only account has a placeholder email, so a provider's email differs.
				allowDifferentEmails: true,
				updateUserInfoOnLink: true,
				// Better Auth counts accounts only; `guardLastMethod` counts passkeys too.
				allowUnlinkingAll: true
			},
			// Access and refresh tokens are stored encrypted with a key derived from the secret.
			encryptOAuthTokens: true
		},
		socialProviders,
		plugins: [
			passkey({
				rpID: new URL(origin).hostname,
				rpName: 'MIDB',
				origin,
				registration: {
					// Passkey-first sign-up: the account is created once the passkey verifies.
					requireSession: false,
					resolveUser: resolveNewPasskeyUser,
					afterVerification: ({ ctx, user }) => createPasskeyUser(ctx, user)
				}
			})
		],
		advanced: {
			// Cloudflare sets this header and replaces any client value.
			ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }
		},
		// Better Auth's limiter counts per isolate, which is not a limit on Workers; `RL_AUTH`
		// wraps the route instead (`src/routes/api/auth/[...all]/+server.ts`).
		rateLimit: { enabled: false },
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				await guardPasskeySignUp(ctx, turnstileSecret);
				await guardLastMethod(ctx);
			})
		},
		databaseHooks: {
			session: {
				create: {
					before: async (session) => {
						const user = await db.query.users.findFirst({
							where: (u, { eq }) => eq(u.id, session.userId),
							columns: { bannedAt: true }
						});
						if (user?.bannedAt) {
							throw new APIError('FORBIDDEN', { message: 'This account is banned.' });
						}
					}
				}
			},
			user: {
				create: {
					// Every new account, whatever the sign-up path, gets a generated username. The
					// reader changes it on /user/profile.
					before: async (user) => ({
						data: {
							...user,
							username: await generateUsername(async (candidate) => {
								const taken = await db.query.users.findFirst({
									where: sql`lower(${users.username}) = ${candidate}`,
									columns: { id: true }
								});
								return Boolean(taken);
							})
						}
					})
				}
			},
			account: { create: { after: adoptProviderEmail } }
		}
	});
}

export type Auth = ReturnType<typeof createAuth>;
