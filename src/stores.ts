import { writable } from 'svelte/store';
import { env } from '$env/dynamic/public';
import type { BoostboxMetadata, BoostboxStored } from '$lib/functions/boostboxMetadata';
import type {
	Block,
	EffectSlotState,
	FiredEffect,
	LnurlInvoiceResponse,
	MainSettings,
	ResolvedNostrEvent,
	UserState,
	WalletState
} from '$lib/types';

type PublicEnvName = `PUBLIC_${string}`;

function requireEnv(name: PublicEnvName): string {
	const value = env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function requireEventHost(): string {
	const host = env.PUBLIC_EVENT_HOST;
	if (!host) {
		throw new Error('PUBLIC_EVENT_HOST is required (e.g. https://curiohoster.com)');
	}
	return host.replace(/\/$/, '');
}

/** Split Kit API base. Always same-origin; /api/sk is proxied by the SvelteKit route. */
export function getRemoteServer(): string {
	return '';
}

/** Alby API base. Same-origin; /api/alby routes are served by SvelteKit. */
export function getAlbyServer(): string {
	return '';
}

export function getEventGuid(): string {
	return requireEnv('PUBLIC_EVENT_GUID');
}

/** Socket.IO URL (direct connection, never proxied). */
export function getEventSocketUrl(eventId?: string): string {
	const id = eventId || getEventGuid();
	return `${requireEventHost()}/event?event_id=${id}`;
}

function optionalEnv(name: PublicEnvName): string | undefined {
	const value = env[name]?.trim();
	return value || undefined;
}

function csvEnv(name: PublicEnvName): string[] {
	const value = optionalEnv(name);
	if (!value) return [];
	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

export function isAlbyEnabled(): boolean {
	return Boolean(optionalEnv('PUBLIC_ALBY_CLIENT_ID'));
}

export function isLiveEnabled(): boolean {
	return env.PUBLIC_LIVE_ENABLED?.trim() === 'true';
}

/** On-screen effect toast. Shown unless PUBLIC_EFFECT_TOAST is "false". */
export function isEffectToastEnabled(): boolean {
	return env.PUBLIC_EFFECT_TOAST?.trim().toLowerCase() !== 'false';
}

const DEFAULT_PLACEHOLDER_VIDEO = 'https://content.jwplatform.com/manifests/yp34SRmf.m3u8';

/** Stand-in video when Split Kit has no live enclosure. On unless PUBLIC_PLACEHOLDER_VIDEO is "false". */
export function isPlaceholderVideoEnabled(): boolean {
	return env.PUBLIC_PLACEHOLDER_VIDEO?.trim().toLowerCase() !== 'false';
}

/** HLS or file URL used when the placeholder video is on and Split Kit has no live enclosure. */
export function getPlaceholderVideoUrl(): string {
	return optionalEnv('PUBLIC_PLACEHOLDER_VIDEO_URL') || DEFAULT_PLACEHOLDER_VIDEO;
}

export function getAlbyClientId(): string {
	return requireEnv('PUBLIC_ALBY_CLIENT_ID');
}

export function getAlbyOAuthUrl(
	redirectUri: string,
	{ codeChallenge }: { codeChallenge?: string } = {}
): string {
	const params = new URLSearchParams({
		client_id: getAlbyClientId(),
		response_type: 'code',
		redirect_uri: redirectUri,
		scope: 'account:read balance:read payments:send invoices:read'
	});
	if (codeChallenge) {
		params.set('code_challenge', codeChallenge);
		params.set('code_challenge_method', 'S256');
	}
	return `https://getalby.com/oauth?${params}`;
}

/** Must match exactly between OAuth authorize, token exchange, and Alby app settings. */
export function getAlbyRedirectUri(url: URL): string {
	const configured = optionalEnv('PUBLIC_ALBY_REDIRECT_URI');
	if (configured) {
		return configured.replace(/\/$/, '');
	}

	let redirectUri = url.origin + url.pathname;
	if (redirectUri.endsWith('/')) {
		redirectUri = redirectUri.slice(0, -1);
	}
	return redirectUri;
}

function getLnurlCallbackTemplate(): string | undefined {
	return optionalEnv('PUBLIC_LNURL_CALLBACK');
}

export function getLightningAddress(): string | undefined {
	return optionalEnv('PUBLIC_LIGHTNING_ADDRESS');
}

/** True when a single public invoice target is configured for non-keysend wallets. */
export function hasPublicLnurlTarget(): boolean {
	return Boolean(getLnurlCallbackTemplate() || getLightningAddress());
}

function lightningAddressWellKnownUrl(address: string): string {
	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`;
}

function resolveCallbackTemplate(eventGuid: string | undefined, template: string): string {
	const guid = eventGuid || getEventGuid();
	return template.replaceAll('{eventGuid}', guid).replaceAll('{guid}', guid);
}

async function resolveCallbackUrl(eventGuid?: string): Promise<string> {
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
		const meta = (await res.json()) as { callback?: string };
		if (!meta.callback) {
			throw new Error('LNURL metadata missing callback');
		}
		return meta.callback;
	}

	throw new Error('PUBLIC_LNURL_CALLBACK or PUBLIC_LIGHTNING_ADDRESS is required');
}

/** Fetch a BOLT11 invoice via LNURL-pay callback URL or lightning address. */
export async function fetchLnurlInvoice(
	eventGuid: string | undefined,
	{
		amount,
		comment,
		senderName,
		blockGuid
	}: {
		amount: number;
		comment: string;
		senderName: string;
		blockGuid?: string;
	}
): Promise<LnurlInvoiceResponse> {
	const callbackBase = await resolveCallbackUrl(eventGuid);
	const url = new URL(callbackBase);
	url.searchParams.set('amount', String(amount));
	url.searchParams.set('comment', comment);
	url.searchParams.set('senderName', senderName);
	url.searchParams.set('blockGuid', blockGuid ?? '');

	const res = await fetch(url.toString());
	if (!res.ok) {
		throw new Error(`LNURL invoice fetch failed: ${res.status}`);
	}
	return res.json() as Promise<LnurlInvoiceResponse>;
}

let boostboxEnabled: Promise<boolean> | undefined;

/** True when the server has a BoostBox API key. The result is cached after a successful check. */
export function isBoostboxEnabled(): Promise<boolean> {
	if (!boostboxEnabled) {
		boostboxEnabled = fetch('/api/boostbox')
			.then(async (res) => {
				if (!res.ok) {
					throw new Error(`BoostBox status failed: ${res.status}`);
				}
				const data = (await res.json()) as { enabled?: boolean };
				return Boolean(data.enabled);
			})
			.catch((err) => {
				boostboxEnabled = undefined;
				console.warn('BoostBox status check failed', err);
				return false;
			});
	}
	return boostboxEnabled;
}

/** Store one split's boost metadata. Returns the permalink and BOLT11 description. */
export async function postBoostbox(body: BoostboxMetadata): Promise<BoostboxStored> {
	const res = await fetch('/api/boostbox', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text.slice(0, 200) || `BoostBox request failed: ${res.status}`);
	}
	return res.json() as Promise<BoostboxStored>;
}

export function getBtcPriceUrl(): string {
	return 'https://blockchain.info/tobtc?currency=USD&value=10000';
}

export function getAppName(): string {
	return env.PUBLIC_APP_NAME?.trim() || 'Boost Beach';
}

export function isVenmoEnabled(): boolean {
	return Boolean(optionalEnv('PUBLIC_VENMO_URL'));
}

export function getVenmoUrl(): string {
	return requireEnv('PUBLIC_VENMO_URL');
}

export function isPayPalEnabled(): boolean {
	return Boolean(optionalEnv('PUBLIC_PAYPAL_URL'));
}

export function getPayPalUrl(): string {
	return requireEnv('PUBLIC_PAYPAL_URL');
}

const DEFAULT_NOSTR_RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.nostr.band'
];

export function getNostrEventPointer(): string | undefined {
	return optionalEnv('PUBLIC_NOSTR_EVENT');
}

export function isNostrEventConfigured(): boolean {
	return Boolean(getNostrEventPointer());
}

export function getNostrRelays(): string[] {
	const configured = optionalEnv('PUBLIC_NOSTR_RELAYS');
	if (!configured) {
		return DEFAULT_NOSTR_RELAYS;
	}
	return configured
		.split(',')
		.map((url) => url.trim())
		.filter(Boolean);
}

const DEFAULT_BOARD_RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.primal.net',
	'wss://nostr-pub.wellorder.net',
	'wss://nostr.oxtr.dev'
];

export interface BoardSettings {
	nostrPubkey?: string;
	nostrZapEvent?: string;
	lnzapPubkeys: string[];
	lnzapEvent?: string;
	after?: string;
	before?: string;
	podcasts: string[];
	eventGuids: string[];
	episodeGuids: string[];
	relays: string[];
}

export function getBoardRelays(): string[] {
	const configured = csvEnv('PUBLIC_BOARD_RELAYS');
	return configured.length ? configured : DEFAULT_BOARD_RELAYS;
}

/** Boost-board sources. Podcast and event identity comes from the server scope. */
export function getBoardSettings(
	scope: Pick<BoardSettings, 'podcasts' | 'eventGuids' | 'episodeGuids'>
): BoardSettings {
	return {
		nostrPubkey: optionalEnv('PUBLIC_BOARD_NOSTR_PUBKEY'),
		nostrZapEvent: optionalEnv('PUBLIC_BOARD_ZAP_EVENT'),
		lnzapPubkeys: csvEnv('PUBLIC_BOARD_LNZAP_PUBKEYS'),
		lnzapEvent: optionalEnv('PUBLIC_BOARD_LNZAP_EVENT'),
		after: optionalEnv('PUBLIC_BOARD_AFTER'),
		before: optionalEnv('PUBLIC_BOARD_BEFORE'),
		podcasts: scope.podcasts,
		eventGuids: scope.eventGuids,
		episodeGuids: scope.episodeGuids,
		relays: getBoardRelays()
	};
}

export function isBoardConfigured(settings: BoardSettings): boolean {
	return Boolean(
		settings.nostrPubkey ||
			settings.nostrZapEvent ||
			settings.lnzapPubkeys.length ||
			settings.lnzapEvent ||
			settings.podcasts.length ||
			settings.eventGuids.length ||
			settings.episodeGuids.length
	);
}

export function getDefaultBackgroundUrl(): string {
	return '/background.jpg';
}

export const albyReady = writable(false);
export const userReady = writable(false);

export const user = writable<UserState>({ loggedIn: false });

export const wallet = writable<WalletState>({
	connected: false,
	balance: null,
	provider: null,
	name: null
});

export const effectSlots = writable<EffectSlotState[]>([]);
export const effectSlotsUpdatedAt = writable(Date.now());
export const livePlaying = writable(false);

export function applyEffectSlots(effects: EffectSlotState[]): void {
	effectSlots.set(effects);
	effectSlotsUpdatedAt.set(Date.now());
}

export const firedEffect = writable<FiredEffect | null>(null);

export function showFiredEffect(effect: FiredEffect): void {
	firedEffect.set(effect);
}

export const liveBlocks = writable<Block[]>([]);
export const mainSettings = writable<MainSettings>({
	splits: 95,
	broadcastMode: 'edit',
	editEnclosure: '',
	broadcastDelay: 0
});

export const liveMode = writable<string | undefined>(undefined);
export const liveEnclosure = writable<string | undefined>(undefined);
export const loaded = writable(false);

export const nostrEvent = writable<ResolvedNostrEvent | null>(null);
