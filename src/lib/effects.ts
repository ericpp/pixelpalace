export const EFFECT_IDS = ['wide', 'bubbles', 'fence', 'dj', 'festoons', 'discoball'] as const;

export type EffectId = (typeof EFFECT_IDS)[number];

export const EFFECT_LABELS: Record<EffectId, string> = {
	wide: 'Wide Pan',
	bubbles: 'Bubbles',
	fence: 'Pixel Curtain Fence',
	dj: 'DJ',
	festoons: 'Festoons',
	discoball: 'Disco Ball'
};

export const EFFECT_ICONS: Record<EffectId, string> = {
	wide: '/props/telescope.png',
	bubbles: '/props/bubbles.png',
	fence: '/props/fence.png',
	dj: '/props/dj.png',
	festoons: '/props/festoons.png',
	discoball: '/props/discoball.png'
};

export function isEffectId(value: string): value is EffectId {
	return (EFFECT_IDS as readonly string[]).includes(value);
}
