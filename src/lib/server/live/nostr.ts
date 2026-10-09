import { createHash } from 'node:crypto';
import { finalizeEvent, nip19 } from 'nostr-tools';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import { hexToBytes } from 'nostr-tools/utils';
import { WebSocket } from 'ws';
import {
	getAppName,
	getEpisodeGuid,
	getNostrNsec,
	getPodcastName,
	getPodcastGuid,
	getNostrRelays
} from './config';

const KIND_APP_DATA = 30078;
const PUBLISH_WAIT_MS = 8_000;

let hookedWs = false;

function ensureNostrWebSocket(): void {
	if (hookedWs) return;
	useWebSocketImplementation(WebSocket);
	hookedWs = true;
}

function secretKeyFromNsec(value: string): Uint8Array {
	if (/^[0-9a-f]{64}$/i.test(value)) {
		return hexToBytes(value);
	}
	const decoded = nip19.decode(value);
	if (decoded.type !== 'nsec') {
		throw new Error('PUBLISH_NOSTR_NSEC must be an nsec or 64-char hex key');
	}
	return decoded.data;
}

function externalContentTags(kind: string, id: string | undefined): string[][] {
	if (!id) return [];
	return [
		['i', `${kind}:${id}`],
		['k', kind]
	];
}

function unixSeconds(value: Date | string | undefined): number {
	if (value instanceof Date) return Math.floor(value.getTime() / 1000);
	if (typeof value === 'string') {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
	}
	return Math.floor(Date.now() / 1000);
}

export async function publishEffect(input: {
	id: string;
	message: string;
	senderName: string;
	eventGuid?: string;
	blockGuid?: string;
	createdAt?: Date | string;
}): Promise<void> {
	const nsec = getNostrNsec();
	if (!nsec) return;

	const relays = getNostrRelays();
	if (!relays.length) return;

	ensureNostrWebSocket();
	const secretKey = secretKeyFromNsec(nsec);
	const creationDate = unixSeconds(input.createdAt);
	const content = JSON.stringify({
		identifier: input.id,
		creation_date: creationDate,
		effect: {
			action: 'effect',
			app_name: getAppName(),
			message: input.message,
			sender_name: input.senderName,
			podcast: getPodcastName() || getAppName(),
			eventGuid: input.eventGuid,
			episode_guid: getEpisodeGuid(),
			blockGuid: input.blockGuid
		}
	});
	const event = finalizeEvent(
		{
			kind: KIND_APP_DATA,
			created_at: creationDate,
			tags: [
				['d', createHash('sha256').update(content).digest('hex')],
				...externalContentTags('podcast:guid', getPodcastGuid()),
				...externalContentTags('podcast:item:guid', getEpisodeGuid())
			],
			content
		},
		secretKey
	);

	const pool = new SimplePool();
	try {
console.log('publishing event', event);
		const results = await Promise.allSettled(
			pool.publish(relays, event, { maxWait: PUBLISH_WAIT_MS })
		);
		const ok = results.filter((result) => result.status === 'fulfilled').length;
		if (!ok) {
			console.error('effect publish failed on all relays');
		}
	} finally {
		pool.destroy();
	}
}
