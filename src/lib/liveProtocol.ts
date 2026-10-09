import type { EffectSlotState, FiredEffect } from '$lib/types';

export type LiveClientMessage = { type: 'playing'; playing: boolean } | { type: 'sync' };

export type LiveServerMessage =
	| { type: 'hello'; effects: EffectSlotState[] }
	| { type: 'effects'; effects: EffectSlotState[] }
	| { type: 'effect'; effect: FiredEffect };
