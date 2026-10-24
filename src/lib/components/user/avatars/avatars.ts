import type { Component } from 'svelte';
import WollstonecraftIcon from './WollstonecraftIcon.svelte';
import PankhurstIcon from './PankhurstIcon.svelte';
import TruthIcon from './TruthIcon.svelte';
import DeBeauvoirIcon from './DeBeauvoirIcon.svelte';
import DavisIcon from './DavisIcon.svelte';
import KahloIcon from './KahloIcon.svelte';

export interface AvatarDef {
	key: string;
	name: string;
	component: Component;
}

export const AVATARS: AvatarDef[] = [
	{ key: 'wollstonecraft', name: 'Mary Wollstonecraft', component: WollstonecraftIcon },
	{ key: 'pankhurst',      name: 'Emmeline Pankhurst',  component: PankhurstIcon },
	{ key: 'truth',          name: 'Sojourner Truth',      component: TruthIcon },
	{ key: 'de-beauvoir',    name: 'Simone de Beauvoir',   component: DeBeauvoirIcon },
	{ key: 'davis',          name: 'Angela Davis',          component: DavisIcon },
	{ key: 'kahlo',          name: 'Frida Kahlo',           component: KahloIcon },
];

export const AVATAR_KEYS = new Set(AVATARS.map(a => a.key));
