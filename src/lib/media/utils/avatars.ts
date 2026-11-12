// Plain avatar data, safe for the server (profile validation) and the client.
// The key → component map lives in #lib/components/user/avatars/avatars.ts.
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
	{ key: 'kahlo', name: 'Frida Kahlo' },
	{ key: 'curie', name: 'Marie Curie' },
	{ key: 'lovelace', name: 'Ada Lovelace' },
	{ key: 'franklin', name: 'Rosalind Franklin' },
	{ key: 'johnson', name: 'Katherine Johnson' },
	{ key: 'hopper', name: 'Grace Hopper' },
	{ key: 'kusama', name: 'Yayoi Kusama' },
	{ key: 'okeeffe', name: "Georgia O'Keeffe" },
	{ key: 'varda', name: 'Agnès Varda' },
	{ key: 'nina-simone', name: 'Nina Simone' },
	{ key: 'woolf', name: 'Virginia Woolf' },
	{ key: 'angelou', name: 'Maya Angelou' },
	{ key: 'lorde', name: 'Audre Lorde' },
	{ key: 'yousafzai', name: 'Malala Yousafzai' },
	{ key: 'ginsburg', name: 'Ruth Bader Ginsburg' }
];

/** The smallest avatar size, in px, that draws eyes, mouth and fine marks (`Portrait.svelte`). */
export const PORTRAIT_DETAIL_MIN = 32;

export const AVATAR_KEYS = new Set(AVATAR_DEFS.map((a) => a.key));
