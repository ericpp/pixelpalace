import { applyEffectSlots, isLiveEnabled, showFiredEffect, livePlaying } from '$/stores';
import type { LiveClientMessage, LiveServerMessage } from '$lib/liveProtocol';
import { sendLiveHeartbeat } from '$lib/live';

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const FALLBACK_WAIT_MS = 2_000;
const HEARTBEAT_MS = 15_000;

let socket: WebSocket | null = null;
let intended = false;
let playing = false;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let fallbackWait: ReturnType<typeof setTimeout> | undefined;
let heartbeatId: ReturnType<typeof setInterval> | undefined;

export function connectLiveSocket(): void {
	if (!isLiveEnabled()) return;
	intended = true;
	openSocket();
}

export function setLivePlaying(value: boolean): void {
	if (!isLiveEnabled()) return;
	if (playing === value) return;
	playing = value;
	livePlaying.set(value);
	if (isSocketOpen()) sendPlaying(value);
	syncHeartbeatFallback();
}

export function requestEffectSync(): void {
	if (!isLiveEnabled() || !playing) return;
	if (isSocketOpen() && socket) {
		const message: LiveClientMessage = { type: 'sync' };
		socket.send(JSON.stringify(message));
		return;
	}
	void sendLiveHeartbeat();
}

function socketUrl(): string {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${proto}//${location.host}/api/live/ws`;
}

function isSocketOpen(): boolean {
	return socket?.readyState === WebSocket.OPEN;
}

function openSocket(): void {
	if (!intended) return;
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
		return;
	}

	scheduleFallback();
	try {
		socket = new WebSocket(socketUrl());
	} catch {
		startFallback();
		scheduleReconnect();
		return;
	}

	socket.addEventListener('open', () => {
		reconnectDelay = RECONNECT_MIN_MS;
		clearFallbackWait();
		stopFallback();
		if (playing) sendPlaying(true);
	});

	socket.addEventListener('message', (event) => {
		if (typeof event.data !== 'string') return;
		handleMessage(event.data);
	});

	socket.addEventListener('close', () => {
		socket = null;
		startFallback();
		scheduleReconnect();
	});
}

function handleMessage(raw: string): void {
	let message: LiveServerMessage;
	try {
		message = JSON.parse(raw) as LiveServerMessage;
	} catch {
		return;
	}

	if (message.type === 'hello' || message.type === 'effects') {
		if (Array.isArray(message.effects)) applyEffectSlots(message.effects);
		return;
	}

	if (message.type === 'effect') {
		showFiredEffect(message.effect);
	}
}

function sendPlaying(value: boolean): void {
	if (!isSocketOpen() || !socket) return;
	const message: LiveClientMessage = { type: 'playing', playing: value };
	socket.send(JSON.stringify(message));
}

function scheduleFallback(): void {
	clearFallbackWait();
	fallbackWait = setTimeout(startFallback, FALLBACK_WAIT_MS);
}

function clearFallbackWait(): void {
	if (!fallbackWait) return;
	clearTimeout(fallbackWait);
	fallbackWait = undefined;
}

function startFallback(): void {
	if (!isLiveEnabled() || isSocketOpen()) return;
	syncHeartbeatFallback();
}

function stopFallback(): void {
	stopHeartbeatFallback();
}

function stopHeartbeatFallback(): void {
	if (!heartbeatId) return;
	clearInterval(heartbeatId);
	heartbeatId = undefined;
}

function syncHeartbeatFallback(): void {
	if (playing && !isSocketOpen() && !heartbeatId) {
		void sendLiveHeartbeat();
		heartbeatId = setInterval(() => {
			void sendLiveHeartbeat();
		}, HEARTBEAT_MS);
	}
	if ((!playing || isSocketOpen()) && heartbeatId) {
		stopHeartbeatFallback();
	}
}

function scheduleReconnect(): void {
	if (!intended || reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = undefined;
		openSocket();
		reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
	}, reconnectDelay);
}
