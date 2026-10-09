import { patchHttpServerForLiveWebSocket } from '$lib/server/live/ws';
import type { Handle } from '@sveltejs/kit';

patchHttpServerForLiveWebSocket();

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
