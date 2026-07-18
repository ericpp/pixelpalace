import { writable } from 'svelte/store';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

const defaultApiServer = 'https://api.thesplitkit.com';

function requireEnv(name) {
	const value = env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function requireEventHost() {
	const host = env.PUBLIC_EVENT_HOST;
	if (!host) {
		throw new Error('PUBLIC_EVENT_HOST is required (e.g. https://curiohoster.com)');
	}
	return host.replace(/\/$/, '');
}

/** Split Kit + Socket.IO host. In dev, returns '' so /api/sk uses the Vite proxy. */
export function getRemoteServer() {
	if (dev) return '';
	return requireEventHost();
}

/** Alby API base. Always connects directly to PUBLIC_API_URL (never proxied). */
export function getAlbyServer() {
	return env.PUBLIC_API_URL || defaultApiServer;
}

export function getEventGuid() {
	return requireEnv('PUBLIC_EVENT_GUID');
}

/** Socket.IO URL (direct connection, never proxied). */
export function getEventSocketUrl(eventId) {
	const id = eventId || getEventGuid();
	return `${requireEventHost()}/event?event_id=${id}`;
}

export function getAlbyClientId() {
	return requireEnv('PUBLIC_ALBY_CLIENT_ID');
}

export function getAlbyOAuthUrl(redirectUri) {
	const params = new URLSearchParams({
		client_id: getAlbyClientId(),
		response_type: 'code',
		redirect_uri: redirectUri,
		scope: 'account:read balance:read payments:send invoices:read'
	});
	return `https://getalby.com/oauth?${params}`;
}

function optionalEnv(name) {
	const value = env[name]?.trim();
	return value || undefined;
}

function getLnurlCallbackTemplate() {
	return optionalEnv('PUBLIC_LNURL_CALLBACK');
}

function getLightningAddress() {
	return optionalEnv('PUBLIC_LIGHTNING_ADDRESS');
}

function lightningAddressWellKnownUrl(address) {
	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`;
}

function resolveCallbackTemplate(eventGuid, template) {
	const guid = eventGuid || getEventGuid();
	return template.replaceAll('{eventGuid}', guid).replaceAll('{guid}', guid);
}

async function resolveCallbackUrl(eventGuid) {
	const callbackTemplate = getLnurlCallbackTemplate();
	if (callbackTemplate) {
		return resolveCallbackTemplate(eventGuid, callbackTemplate);
	}

	const address = getLightningAddress();
	if (address) {
		const res = await fetch(lightningAddressWellKnownUrl(address));
		if (!res.ok) {
			throw new Error(`LNURL metadata fetch failed: ${res.status}`);
		}
		const meta = await res.json();
		if (!meta.callback) {
			throw new Error('LNURL metadata missing callback');
		}
		return meta.callback;
	}

	throw new Error('PUBLIC_LNURL_CALLBACK or PUBLIC_LIGHTNING_ADDRESS is required');
}

/** Fetch a BOLT11 invoice via LNURL-pay callback URL or lightning address. */
export async function fetchLnurlInvoice(eventGuid, { amount, comment, senderName, blockGuid }) {
	const callbackBase = await resolveCallbackUrl(eventGuid);
	const url = new URL(callbackBase);
	url.searchParams.set('amount', String(amount));
	url.searchParams.set('comment', comment);
	url.searchParams.set('senderName', senderName);
	url.searchParams.set('blockGuid', blockGuid);

	const res = await fetch(url.toString());
	if (!res.ok) {
		throw new Error(`LNURL invoice fetch failed: ${res.status}`);
	}
	return res.json();
}

export function getBtcPriceUrl() {
	return 'https://blockchain.info/tobtc?currency=USD&value=10000';
}

export function getAppName() {
	return env.PUBLIC_APP_NAME?.trim() || 'Boost Beach';
}

export function getVenmoUrl() {
	return requireEnv('PUBLIC_VENMO_URL');
}

export function getDefaultBackgroundUrl() {
	return 'https://images.pexels.com/photos/10819642/pexels-photo-10819642.jpeg';
}

export const albyReady = writable(false);
export const userReady = writable(false);

export const user = writable({ loggedIn: false });

export const wallet = writable({ connected: false, balance: null, provider: null });

export const liveBlocks = writable([]);
export const mainSettings = writable({
	splits: 95,
	broadcastMode: 'edit',
	editEnclosure: '',
	broadcastDelay: 0
});

export const liveMode = writable();
export const liveEnclosure = writable();
export const loaded = writable(false);
