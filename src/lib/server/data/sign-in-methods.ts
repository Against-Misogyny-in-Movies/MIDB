import { count, eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { accounts, passkeys } from '#db/schema/auth.ts';

/** What `/user/settings` needs for its first paint: how many sign-in methods an account has, and which providers. */
export interface SignInMethodCounts {
	/** The provider id of each linked account (`google`, `discord`), in a stable order. */
	linked: string[];
	passkeys: number;
}

/**
 * The account's linked providers and its number of passkeys, so the page can reserve the rows
 * its methods card loads in the browser. Ids and a count only: no token, key or credential.
 */
export async function getSignInMethodCounts(userId: string): Promise<SignInMethodCounts> {
	const [linked, [passkeyCount]] = await Promise.all([
		db
			.select({ providerId: accounts.providerId })
			.from(accounts)
			.where(eq(accounts.userId, userId))
			.orderBy(accounts.providerId, accounts.id),
		db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId))
	]);
	return { linked: linked.map((row) => row.providerId), passkeys: passkeyCount?.n ?? 0 };
}
