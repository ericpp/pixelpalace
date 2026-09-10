import { SimplePool, nip19 } from 'nostr-tools';
import type { Event, Filter } from 'nostr-tools';
import type { ResolvedNostrEvent } from '$lib/types';

const HEX64 = /^[a-fA-F0-9]{64}$/;

export function uniqueRelays(...lists: Array<string[] | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const list of lists) {
		for (const url of list || []) {
			const trimmed = url.trim();
			if (trimmed && !seen.has(trimmed)) {
				seen.add(trimmed);
				out.push(trimmed);
			}
		}
	}
	return out;
}

function eventTitle(event: Event): string {
	const title = event.tags.find((tag) => tag[0] === 'title')?.[1];
	if (title) return title;
	const content = event.content.trim();
	if (!content || content.startsWith('{') || content.startsWith('[')) return 'Nostr event';
	return content.length > 80 ? `${content.slice(0, 77)}…` : content;
}

function addressCoordinate(event: Event): string | undefined {
	if (event.kind < 30000 || event.kind >= 40000) return undefined;
	const d = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
	return `${event.kind}:${event.pubkey}:${d}`;
}

function encodeBech32(event: Event, relays: string[]): string {
	const address = addressCoordinate(event);
	if (address) {
		const identifier = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
		return nip19.naddrEncode({
			identifier,
			pubkey: event.pubkey,
			kind: event.kind,
			relays
		});
	}
	return nip19.neventEncode({
		id: event.id,
		relays,
		author: event.pubkey,
		kind: event.kind
	});
}

export function nostrEventHref(ref: ResolvedNostrEvent): string {
	return `https://njump.me/${ref.bech32}`;
}

export function parseNostrPointer(pointer: string, fallbackRelays: string[]): ResolvedNostrEvent {
	if (HEX64.test(pointer)) {
		const id = pointer.toLowerCase();
		return {
			pointer,
			bech32: nip19.noteEncode(id),
			eventId: id,
			pubkey: '',
			kind: 1,
			relays: uniqueRelays(fallbackRelays),
			title: 'Nostr event',
			tags: [],
			loaded: false
		};
	}

	const decoded = nip19.decode(pointer);
	const relays = uniqueRelays(decoded.type === 'naddr' || decoded.type === 'nevent' ? decoded.data.relays : [], fallbackRelays);

	if (decoded.type === 'note') {
		return {
			pointer,
			bech32: pointer,
			eventId: decoded.data,
			pubkey: '',
			kind: 1,
			relays,
			title: 'Nostr event',
			tags: [],
			loaded: false
		};
	}

	if (decoded.type === 'nevent') {
		return {
			pointer,
			bech32: pointer,
			eventId: decoded.data.id,
			pubkey: decoded.data.author || '',
			kind: decoded.data.kind || 1,
			relays,
			title: 'Nostr event',
			tags: [],
			loaded: false
		};
	}

	if (decoded.type === 'naddr') {
		return {
			pointer,
			bech32: pointer,
			eventId: '',
			pubkey: decoded.data.pubkey,
			kind: decoded.data.kind,
			address: `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`,
			relays,
			title: 'Nostr event',
			tags: [],
			loaded: false
		};
	}

	throw new Error(`Unsupported Nostr pointer type: ${decoded.type}`);
}

export function canZapEvent(ref: ResolvedNostrEvent | null | undefined): boolean {
	return Boolean(ref?.pubkey);
}

function pointerFilter(ref: ResolvedNostrEvent): Filter | null {
	if (ref.address) {
		const [, pubkey, identifier] = ref.address.split(':');
		if (!pubkey) return null;
		return {
			kinds: [ref.kind],
			authors: [pubkey],
			'#d': [identifier ?? '']
		};
	}
	if (ref.eventId) {
		return { ids: [ref.eventId] };
	}
	return null;
}

export async function hydrateNostrEvent(ref: ResolvedNostrEvent): Promise<ResolvedNostrEvent> {
	const filter = pointerFilter(ref);
	if (!filter || !ref.relays.length) {
		return { ...ref, loaded: true };
	}

	const pool = new SimplePool();
	try {
		const event = await pool.get(ref.relays, filter, { maxWait: 8000 });
		if (!event) {
			return { ...ref, loaded: true };
		}

		return {
			...ref,
			bech32: encodeBech32(event, ref.relays),
			eventId: event.id,
			pubkey: event.pubkey,
			kind: event.kind,
			address: addressCoordinate(event) ?? ref.address,
			title: eventTitle(event),
			tags: event.tags,
			loaded: true
		};
	} finally {
		pool.destroy();
	}
}
