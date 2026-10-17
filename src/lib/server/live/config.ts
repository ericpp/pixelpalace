import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

function trim(value: string | undefined): string | undefined {
	return value?.trim() || undefined;
}

function intEnv(value: string | undefined, fallback: number, min = 1): number {
	const raw = trim(value);
	if (!raw) return fallback;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function isLiveEnabled(): boolean {
	return publicEnv.PUBLIC_LIVE_ENABLED?.trim() === 'true';
}

export function getDatabaseUrl(): string | undefined {
	return trim(env.DATABASE_URL);
}

export function getViewerJwtSecret(): string {
	const secret = trim(env.VIEWER_JWT);
	if (!secret) {
		error(500, 'VIEWER_JWT is not configured');
	}
	return secret.split(/\s+/)[0];
}

export function getEffectWebhook(): string | undefined {
	return trim(env.EFFECT_WEBHOOK);
}

export function getAppName(): string {
	return publicEnv.PUBLIC_APP_NAME?.trim() || 'Boost Beach';
}

export function getNostrNsec(): string | undefined {
	return trim(env.PUBLISH_NOSTR_NSEC);
}

export function getPodcastName(): string | undefined {
	return trim(env.PODCAST_NAME);
}

export function getPodcastGuid(): string | undefined {
	return trim(env.PODCAST_GUID);
}

export function getEpisodeGuid(): string | undefined {
	return trim(env.EPISODE_GUID);
}

function unique(values: Array<string | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		if (value && !seen.has(value)) {
			seen.add(value);
			out.push(value);
		}
	}
	return out;
}

function csv(value: string | undefined): string[] {
	const trimmed = trim(value);
	if (!trimmed) return [];
	return unique(trimmed.split(',').map((part) => part.trim()));
}

/** Podcast and event identity the boost board scores against. */
export function getBoardScope(): {
	podcasts: string[];
	eventGuids: string[];
	episodeGuids: string[];
} {
	const podcasts = csv(publicEnv.PUBLIC_BOARD_PODCASTS);
	const eventGuids = csv(publicEnv.PUBLIC_BOARD_EVENT_GUIDS);
	const episodeGuids = csv(publicEnv.PUBLIC_BOARD_EPISODE_GUIDS);

	return {
		podcasts: podcasts.length
			? podcasts
			: unique([getPodcastName(), trim(publicEnv.PUBLIC_APP_NAME)]),
		eventGuids: eventGuids.length ? eventGuids : unique([trim(publicEnv.PUBLIC_EVENT_GUID)]),
		episodeGuids: episodeGuids.length ? episodeGuids : unique([getEpisodeGuid()])
	};
}

export function getNostrRelays(): string[] {
	const configured = trim(env.PUBLISH_NOSTR_RELAYS) || trim(publicEnv.PUBLIC_NOSTR_RELAYS);
	if (configured) {
		return configured
			.split(',')
			.map((url) => url.trim())
			.filter(Boolean);
	}
	return [
		'wss://relay.damus.io',
		'wss://nos.lol',
		'wss://relay.primal.net',
		'wss://nostr-pub.wellorder.net',
		'wss://nostr.oxtr.dev'
	];
}

export function getUnlockConfig() {
	return {
		unlockSeconds: intEnv(env.EFFECT_UNLOCK_SECONDS, 60, 0)
	};
}
