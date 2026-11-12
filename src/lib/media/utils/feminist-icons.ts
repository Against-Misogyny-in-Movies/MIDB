import { USERNAME_MAX } from './username.ts';

/** The digits after the name in a generated username (`audre_lorde_0427`). */
export const GENERATED_DIGITS = 4;

/** The longest icon name that leaves room for `_` and the digits within `USERNAME_MAX`. */
export const ICON_NAME_MAX = USERNAME_MAX - 1 - GENERATED_DIGITS;

/**
 * Feminist figures from many eras and regions. A new account's generated username is one of
 * these plus `_` and four random digits (`#lib/server/auth/generate-username.ts`). Each entry
 * is lowercase ASCII with underscores (accents transliterated) and at most `ICON_NAME_MAX`
 * characters.
 */
export const FEMINIST_ICONS = [
	'audre_lorde',
	'bell_hooks',
	'simone_de_beauvoir',
	'sojourner_truth',
	'mary_wollstonecraft',
	'malala_yousafzai',
	'gloria_steinem',
	'frida_kahlo',
	'angela_davis',
	'chimamanda_adichie',
	'emmeline_pankhurst',
	'rigoberta_menchu',
	'wangari_maathai',
	'kate_sheppard',
	'savitribai_phule',
	'virginia_woolf',
	'rosa_parks',
	'harriet_tubman',
	'ida_b_wells',
	'susan_b_anthony',
	'elizabeth_cady_stanton',
	'olympe_de_gouges',
	'flora_tristan',
	'huda_shaarawi',
	'qiu_jin',
	'kartini',
	'fatima_mernissi',
	'nawal_el_saadawi',
	'rokeya_sakhawat_hussain',
	'pandita_ramabai',
	'mary_mcleod_bethune',
	'shirley_chisholm',
	'dolores_huerta',
	'ruth_bader_ginsburg',
	'maya_angelou',
	'toni_morrison',
	'alice_walker',
	'adrienne_rich',
	'betty_friedan',
	'kimberle_crenshaw',
	'marsha_p_johnson',
	'vandana_shiva',
	'wilma_mankiller',
	'gerda_lerner',
	'clara_zetkin',
	'emma_goldman',
	'nellie_mcclung',
	'leymah_gbowee',
	'ellen_johnson_sirleaf',
	'funmilayo_ransome_kuti',
	'shirin_ebadi',
	'tarana_burke',
	'sylvia_rivera'
] as const;
