import { json } from '@sveltejs/kit';
import { isEffectId } from '$lib/effects';
import {
	consumeEffectUnlock,
	EffectLockedError,
	publishEffectBoost
} from '$lib/server/live/unlocks';
import { liveUnavailableResponse } from '$lib/server/live/http';
import { getOrCreateViewerId } from '$lib/server/live/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const unavailable = liveUnavailableResponse();
	if (unavailable) return unavailable;

	try {
		const body = (await request.json()) as {
			action?: unknown;
			effectId?: unknown;
			message?: unknown;
			senderName?: unknown;
			eventGuid?: unknown;
			blockGuid?: unknown;
		};
		const effectId = typeof body.effectId === 'string' ? body.effectId : '';
		if (!isEffectId(effectId)) {
			return json({ message: 'Unknown item' }, { status: 400 });
		}

		const viewerId = await getOrCreateViewerId(cookies);
		if (body.action === 'lock') {
			const effects = await consumeEffectUnlock(viewerId, effectId);
			return json({ effects });
		}

		const result = await publishEffectBoost({
			viewerId,
			effectId,
			message: typeof body.message === 'string' ? body.message : '',
			senderName: typeof body.senderName === 'string' ? body.senderName : '',
			eventGuid: typeof body.eventGuid === 'string' ? body.eventGuid : undefined,
			blockGuid: typeof body.blockGuid === 'string' ? body.blockGuid : undefined
		});

		return json({ effects: result.effects, effect: result.effect });
	} catch (err) {
		if (err instanceof EffectLockedError) {
			return json({ message: err.message, effects: err.effects }, { status: 409 });
		}
		console.error('live/effect error:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
};
