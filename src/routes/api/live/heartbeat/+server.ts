import { json } from '@sveltejs/kit';
import { applyHeartbeat } from '$lib/server/live/unlocks';
import { liveUnavailableResponse } from '$lib/server/live/http';
import { getOrCreateViewerId } from '$lib/server/live/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const unavailable = liveUnavailableResponse();
	if (unavailable) return unavailable;

	try {
		const body = (await request.json().catch(() => ({}))) as { playing?: unknown };
		const playing = body.playing === true;
		const viewerId = await getOrCreateViewerId(cookies);
		const result = await applyHeartbeat(viewerId, playing);
		return json(result);
	} catch (err) {
		console.error('live/heartbeat error:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
};
