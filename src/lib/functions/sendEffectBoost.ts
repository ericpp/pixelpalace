import { applyEffectSlots, showFiredEffect } from '$/stores';
import type { EffectSlotState, FiredEffect } from '$lib/types';

type EffectResponse = {
	message?: string;
	effects?: EffectSlotState[];
	effect?: FiredEffect;
};

function applyResponse(data: EffectResponse): void {
	if (Array.isArray(data.effects)) applyEffectSlots(data.effects);
	if (data.effect) showFiredEffect(data.effect);
}

async function postEffect(body: Record<string, unknown>): Promise<EffectResponse> {
	const res = await fetch('/api/live/effect', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const data = (await res.json()) as EffectResponse;
	applyResponse(data);
	if (!res.ok) {
		throw new Error(data.message || 'Effect failed');
	}
	return data;
}

export default async function sendEffectBoost({
	effectId,
	boostagram,
	senderName,
	eventGuid,
	blockGuid
}: {
	effectId: string;
	boostagram: string;
	senderName: string;
	eventGuid?: string;
	blockGuid?: string;
}): Promise<void> {
	await postEffect({
		action: 'send',
		effectId,
		message: boostagram,
		senderName,
		eventGuid,
		blockGuid
	});
}

export async function lockEffectSlot(effectId: string): Promise<void> {
	await postEffect({ action: 'lock', effectId });
}
