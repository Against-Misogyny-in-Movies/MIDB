/** The social sign-in providers: id (Better Auth's), label and Remixicon icon. */
export const AUTH_PROVIDERS = [
	{ id: 'google', label: 'Google', icon: 'ri-google-fill' },
	{ id: 'discord', label: 'Discord', icon: 'ri-discord-fill' }
] as const;

export type Provider = (typeof AUTH_PROVIDERS)[number];
export type ProviderId = Provider['id'];

/** Which providers have credentials on this deployment (`configuredProviders`). */
export type ConfiguredProviders = Record<ProviderId, boolean>;

/** The provider for an id Better Auth reported, or undefined for one MIDB does not offer. */
export function findProvider(id: string): Provider | undefined {
	return AUTH_PROVIDERS.find((p) => p.id === id);
}

/** A provider's label, or the raw id for an unknown one. */
export function providerLabel(id: string): string {
	return findProvider(id)?.label ?? id;
}

/** A provider's icon class, or a generic user icon for an unknown one. */
export function providerIcon(id: string): string {
	return findProvider(id)?.icon ?? 'ri-user-line';
}
