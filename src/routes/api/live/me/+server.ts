import { json } from '@sveltejs/kit';
import { getEffectSlots } from '$lib/server/live/unlocks';
import { liveUnavailableResponse } from '$lib/server/live/http';
import { getOrCreateViewerId } from '$lib/server/live/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	const unavailable = liveUnavailableResponse();
	if (unavailable) return unavailable;

	try {
		const viewerId = await getOrCreateViewerId(cookies);
		const effects = await getEffectSlots(viewerId);
		return json({ effects });
	} catch (err) {
		console.error('live/me error:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
};
