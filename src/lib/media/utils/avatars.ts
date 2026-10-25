// Plain avatar data, safe for the server (profile validation) and the client.
// The key → component map lives in $lib/components/user/avatars/avatars.ts.
export interface AvatarDef {
	key: string;
	name: string;
}

export const AVATAR_DEFS: AvatarDef[] = [
	{ key: 'wollstonecraft', name: 'Mary Wollstonecraft' },
	{ key: 'pankhurst', name: 'Emmeline Pankhurst' },
	{ key: 'truth', name: 'Sojourner Truth' },
	{ key: 'de-beauvoir', name: 'Simone de Beauvoir' },
	{ key: 'davis', name: 'Angela Davis' },
	{ key: 'kahlo', name: 'Frida Kahlo' }
];

export const AVATAR_KEYS = new Set(AVATAR_DEFS.map((a) => a.key));
