import type { LiveServerMessage } from '$lib/liveProtocol';
import type { FiredEffect } from '$lib/types';

export type LiveSocketClient = {
	send: (message: LiveServerMessage) => void;
};

type Hub = {
	clients: Set<LiveSocketClient>;
};

const HUB_KEY = '__boostbeachLiveHub';

function getHub(): Hub {
	const globalState = globalThis as typeof globalThis & { [HUB_KEY]?: Hub };
	if (!globalState[HUB_KEY]) {
		globalState[HUB_KEY] = { clients: new Set() };
	}
	return globalState[HUB_KEY];
}

export function addLiveClient(client: LiveSocketClient): void {
	getHub().clients.add(client);
}

export function removeLiveClient(client: LiveSocketClient): void {
	getHub().clients.delete(client);
}

export function broadcastFiredEffect(effect: FiredEffect): void {
	broadcast({ type: 'effect', effect });
}

function broadcast(message: LiveServerMessage): void {
	for (const client of getHub().clients) {
		try {
			client.send(message);
		} catch {
			// Drop clients that cannot receive.
		}
	}
}
