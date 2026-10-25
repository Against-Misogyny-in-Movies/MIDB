import type { Component } from 'svelte';
import WollstonecraftIcon from './WollstonecraftIcon.svelte';
import PankhurstIcon from './PankhurstIcon.svelte';
import TruthIcon from './TruthIcon.svelte';
import DeBeauvoirIcon from './DeBeauvoirIcon.svelte';
import DavisIcon from './DavisIcon.svelte';
import KahloIcon from './KahloIcon.svelte';

// key → component; the keys and display names live in $lib/media/utils/avatars.ts.
export const AVATAR_COMPONENTS: Record<string, Component<{ size?: number }>> = {
	wollstonecraft: WollstonecraftIcon,
	pankhurst: PankhurstIcon,
	truth: TruthIcon,
	'de-beauvoir': DeBeauvoirIcon,
	davis: DavisIcon,
	kahlo: KahloIcon
};
