import http from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { getDatabaseUrl, isLiveEnabled } from './config';
import { applyHeartbeat, getEffectSlots } from './unlocks';
import { addLiveClient, removeLiveClient, type LiveSocketClient } from './hub';
import { getViewerIdFromCookieHeader } from './session';
import type { LiveClientMessage, LiveServerMessage } from '$lib/liveProtocol';
import type { EffectSlotState } from '$lib/types';

const ATTACHED = Symbol.for('boostbeach.liveWss');
const LISTEN_PATCHED = Symbol.for('boostbeach.liveWsListenPatched');
const WS_PATH = '/api/live/ws';
const HEARTBEAT_MS = 15_000;
const PING_MS = 30_000;

type HttpServer = http.Server;
type TaggedServer = HttpServer & { [ATTACHED]?: boolean };
type ServerCtor = typeof http.Server & { [LISTEN_PATCHED]?: boolean };

export function attachLiveWebSocket(server: HttpServer | null | undefined): void {
	if (!server) return;
	const tagged = server as TaggedServer;
	if (tagged[ATTACHED]) return;
	tagged[ATTACHED] = true;

	const wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
		const path = (req.url || '').split('?')[0];
		if (path !== WS_PATH) return;
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit('connection', ws, req);
		});
	});

	wss.on('connection', (ws, req) => {
		void handleConnection(ws, req);
	});
}

export function patchHttpServerForLiveWebSocket(): void {
	const ctor = http.Server as ServerCtor;
	if (ctor[LISTEN_PATCHED]) return;
	ctor[LISTEN_PATCHED] = true;
	const originalListen = ctor.prototype.listen;
	ctor.prototype.listen = function (this: HttpServer, ...args: unknown[]) {
		attachLiveWebSocket(this);
		return originalListen.apply(this, args as never);
	};
}

async function handleConnection(ws: WebSocket, req: http.IncomingMessage): Promise<void> {
	if (!isLiveEnabled() || !getDatabaseUrl()) {
		ws.close(1008, 'disabled');
		return;
	}

	const viewerId = getViewerIdFromCookieHeader(req.headers.cookie);
	const client: LiveSocketClient = {
		send(message: LiveServerMessage) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify(message));
			}
		}
	};

	addLiveClient(client);

	let playing = false;
	let tickId: ReturnType<typeof setInterval> | undefined;
	let cleaned = false;
	const pingId = setInterval(() => {
		if (ws.readyState === WebSocket.OPEN) ws.ping();
	}, PING_MS);

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		removeLiveClient(client);
		if (tickId) clearInterval(tickId);
		clearInterval(pingId);
	};

	ws.on('close', cleanup);
	ws.on('error', cleanup);

	try {
		const effects = await getEffectSlots(viewerId);
		client.send({ type: 'hello', effects });
	} catch {
		client.send({ type: 'hello', effects: [] });
	}

	let ticking = false;
	const creditWatchTime = async (): Promise<EffectSlotState[] | null> => {
		if (!viewerId || !playing || ticking) return null;
		ticking = true;
		try {
			const result = await applyHeartbeat(viewerId, true);
			if (!playing) return null;
			return result.effects;
		} catch {
			return null;
		} finally {
			ticking = false;
		}
	};

	ws.on('message', (data) => {
		void (async () => {
			let message: LiveClientMessage;
			try {
				message = JSON.parse(data.toString()) as LiveClientMessage;
			} catch {
				return;
			}
			if (message.type === 'sync') {
				if (playing) await creditWatchTime();
				try {
					client.send({ type: 'effects', effects: await getEffectSlots(viewerId) });
				} catch {
					// Slot lookup is best-effort.
				}
				return;
			}
			if (message.type !== 'playing' || typeof message.playing !== 'boolean') return;

			if (message.playing && !playing) {
				playing = true;
				if (tickId) clearInterval(tickId);
				tickId = setInterval(() => {
					void creditWatchTime();
				}, HEARTBEAT_MS);
				await creditWatchTime();
			} else if (!message.playing && playing) {
				playing = false;
				if (tickId) {
					clearInterval(tickId);
					tickId = undefined;
				}
			}
		})();
	});
}
