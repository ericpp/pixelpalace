import { applyEffectSlots, isLiveEnabled } from '$/stores';
import type { EffectSlotState } from '$lib/types';

export async function loadLiveSession(): Promise<void> {
	if (!isLiveEnabled()) return;

	try {
		const res = await fetch('/api/live/me', { credentials: 'include' });
		const data = (await res.json()) as { effects?: EffectSlotState[] };
		if (Array.isArray(data.effects)) applyEffectSlots(data.effects);
	} catch {
		// Effect state is best-effort.
	}
}

export async function sendLiveHeartbeat(): Promise<void> {
	if (!isLiveEnabled()) return;

	try {
		const res = await fetch('/api/live/heartbeat', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playing: true })
		});
		if (!res.ok) return;
		const data = (await res.json()) as { effects?: EffectSlotState[] };
		if (Array.isArray(data.effects)) applyEffectSlots(data.effects);
	} catch {
		// Effect unlocks are best-effort.
	}
}
