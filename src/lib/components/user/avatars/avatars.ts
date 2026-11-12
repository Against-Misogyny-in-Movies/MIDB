import type { Component } from 'svelte';
import WollstonecraftIcon from './WollstonecraftIcon.svelte';
import PankhurstIcon from './PankhurstIcon.svelte';
import TruthIcon from './TruthIcon.svelte';
import DeBeauvoirIcon from './DeBeauvoirIcon.svelte';
import DavisIcon from './DavisIcon.svelte';
import KahloIcon from './KahloIcon.svelte';
import CurieIcon from './CurieIcon.svelte';
import LovelaceIcon from './LovelaceIcon.svelte';
import FranklinIcon from './FranklinIcon.svelte';
import JohnsonIcon from './JohnsonIcon.svelte';
import HopperIcon from './HopperIcon.svelte';
import KusamaIcon from './KusamaIcon.svelte';
import OkeeffeIcon from './OkeeffeIcon.svelte';
import VardaIcon from './VardaIcon.svelte';
import SimoneIcon from './SimoneIcon.svelte';
import WoolfIcon from './WoolfIcon.svelte';
import AngelouIcon from './AngelouIcon.svelte';
import LordeIcon from './LordeIcon.svelte';
import YousafzaiIcon from './YousafzaiIcon.svelte';
import GinsburgIcon from './GinsburgIcon.svelte';

// key → component; the keys and display names live in #lib/media/utils/avatars.ts.
export const AVATAR_COMPONENTS: Record<string, Component<{ size?: number }>> = {
	wollstonecraft: WollstonecraftIcon,
	pankhurst: PankhurstIcon,
	truth: TruthIcon,
	'de-beauvoir': DeBeauvoirIcon,
	davis: DavisIcon,
	kahlo: KahloIcon,
	curie: CurieIcon,
	lovelace: LovelaceIcon,
	franklin: FranklinIcon,
	johnson: JohnsonIcon,
	hopper: HopperIcon,
	kusama: KusamaIcon,
	okeeffe: OkeeffeIcon,
	varda: VardaIcon,
	simone: SimoneIcon,
	woolf: WoolfIcon,
	angelou: AngelouIcon,
	lorde: LordeIcon,
	yousafzai: YousafzaiIcon,
	ginsburg: GinsburgIcon
};
