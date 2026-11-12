import type { BetterAuthOptions } from 'better-auth';

type AccountCreateAfter = NonNullable<
	NonNullable<NonNullable<BetterAuthOptions['databaseHooks']>['account']>['create']
>['after'];

/**
 * The endpoint context Better Auth hands to hooks and plugin callbacks (its
 * `GenericEndpointContext`, which the package does not export), derived from the hook type.
 */
export type AuthEndpointContext = NonNullable<Parameters<NonNullable<AccountCreateAfter>>[1]>;
