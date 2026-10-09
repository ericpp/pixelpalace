export const EFFECT_IDS = ['wide', 'dj', 'festoons', 'bubbles', 'mystery'] as const;

export type EffectId = (typeof EFFECT_IDS)[number];

export const EFFECT_LABELS: Record<EffectId, string> = {
	wide: 'Wide Pan',
	dj: 'DJ',
	festoons: 'Festoons',
	bubbles: 'Bubbles',
	mystery: '???'
};

export const EFFECT_ICONS: Record<EffectId, string> = {
	wide: '/props/telescope.png',
	dj: '/props/dj.png',
	festoons: '/props/festoons.png',
	bubbles: '/props/bubbles.png',
	mystery: '/props/mystery.png'
};

export function isEffectId(value: string): value is EffectId {
	return (EFFECT_IDS as readonly string[]).includes(value);
}
