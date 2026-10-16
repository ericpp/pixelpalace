import { SimplePool, nip19 } from 'nostr-tools';
import type { Event, Filter } from 'nostr-tools';
import { writable, type Readable } from 'svelte/store';

const STORED_BOOSTS_URL = 'https://boostboard.vercel.app/api/boosts';
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_IDENTIFIERS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;
const PROFILE_INTERVAL_MS = 1000;
const OLD_EVENT_WINDOW_MS = 5000;

export interface BoardScore {
	name: string;
	sats: number;
}

export interface BoostBoardOptions {
	relays: string[];
	nostrPubkey?: string;
	zapEvent?: string;
	after?: string | number;
	before?: string | number;
	podcasts?: string[];
	eventGuids?: string[];
	episodeGuids?: string[];
	excludePodcasts?: string[];
	slots: number;
}

interface BoardPayment {
	type: string;
	action: string;
	identifier: string;
	creation_date: number;
	sender_name: string;
	app_name: string;
	podcast: string;
	event_guid: string | null;
	episode_guid: string | null;
	episode: string | null;
	sats: number;
	message?: string;
	isOld: boolean;
	isTest?: boolean;
}

interface BoardFilters {
	after?: number;
	before?: number;
	podcasts?: string[];
	eventGuids?: string[];
	episodeGuids?: string[];
	excludePodcasts?: string[];
}

interface Boostagram {
	action?: string;
	sender_name?: string;
	app_name?: string;
	podcast?: string;
	eventGuid?: string;
	episode_guid?: string;
	episode?: string;
	value_msat_total?: number;
	message?: string;
}

interface StoredInvoice {
	identifier?: string;
	creation_date?: number;
	boostagram?: Boostagram;
}

interface NostrProfile {
	display_name?: string;
	name?: string;
	picture?: string;
}

const topBoostersStore = writable<BoardScore[]>([]);

export const topBoosters: Readable<BoardScore[]> = topBoostersStore;

let active: BoostBoard | null = null;

export function startBoostBoard(options: BoostBoardOptions): () => void {
	const hasBoostSource = Boolean(
		options.nostrPubkey ||
			options.podcasts?.length ||
			options.eventGuids?.length ||
			options.episodeGuids?.length
	);
	if (!hasBoostSource && !options.zapEvent) {
		return () => {};
	}

	active?.destroy();
	const board = new BoostBoard(options);
	active = board;
	void board.start();

	return () => {
		if (active === board) active = null;
		board.destroy();
	};
}

export function testBoost(name: string, sats: number): void {
	active?.testBoost(name, sats);
}

class Scores {
	private scores: Record<string, BoardScore> = {};
	private pending = false;

	constructor(private slots: number) {}

	add(payment: BoardPayment): void {
		const name = (payment.sender_name || '').toUpperCase().replace(/[^ -~]+/g, '');
		if (!this.scores[name]) {
			this.scores[name] = { name, sats: 0 };
		}
		this.scores[name].sats += payment.sats;
		this.publish();
	}

	reset(): void {
		this.scores = {};
		this.pending = false;
		topBoostersStore.set([]);
	}

	private publish(): void {
		if (this.pending) return;
		this.pending = true;
		queueMicrotask(() => {
			this.pending = false;
			const top = Object.values(this.scores)
				.sort((a, b) => b.sats - a.sats)
				.slice(0, this.slots);
			topBoostersStore.set(top);
		});
	}
}

class BoostBoard {
	private relays: string[];
	private nostrPubkey?: string;
	private zapEvent?: string;
	private loadBoosts: boolean;
	private filters: BoardFilters = {};
	private lastBoostAt: number | null = null;
	private identifiers = new Set<string>();
	private identifierOrder: string[] = [];
	private watcher: NostrWatcher;
	private scores: Scores;
	private destroyed = false;
	private fetchAbort: AbortController | null = null;

	constructor(options: BoostBoardOptions) {
		this.relays = options.relays;
		this.nostrPubkey = options.nostrPubkey;
		this.zapEvent = options.zapEvent;
		this.loadBoosts = Boolean(
			options.nostrPubkey ||
				options.podcasts?.length ||
				options.eventGuids?.length ||
				options.episodeGuids?.length
		);
		this.scores = new Scores(options.slots);
		this.scores.reset();
		this.watcher = new NostrWatcher(this.relays);

		if (options.after != null && options.after !== '') this.setFilter('after', options.after);
		if (options.before != null && options.before !== '') this.setFilter('before', options.before);
		if (options.podcasts?.length) this.filters.podcasts = options.podcasts;
		if (options.eventGuids?.length) this.filters.eventGuids = options.eventGuids;
		if (options.episodeGuids?.length) this.filters.episodeGuids = options.episodeGuids;
		if (options.excludePodcasts?.length) this.filters.excludePodcasts = options.excludePodcasts;
	}

	private setFilter(name: 'after' | 'before', value: string | number): void {
		const parsed = parseTimeFilter(value);
		if (name === 'after') this.lastBoostAt = parsed;
		this.filters[name] = parsed;
	}

	async start(): Promise<void> {
		if (this.destroyed) return;

		try {
			if (this.loadBoosts) {
				await this.loadStoredBoosts();
			}
			if (this.destroyed) return;
			if (this.nostrPubkey) {
				this.watcher.subscribeBoosts(this.nostrPubkey, (payment) => {
					if (this.destroyed) return;
					if (this.lastBoostAt && this.lastBoostAt > payment.creation_date) return;
					this.add(payment);
				});
			}
			if (this.zapEvent) {
				this.watcher.subscribeZaps(this.zapEvent, (payment) => {
					if (this.destroyed) return;
					this.add(payment);
				});
			}
		} catch (error) {
			if (!this.destroyed) console.error('Error starting boost board:', error);
		}
	}

	testBoost(name: string, sats: number): void {
		this.add({
			type: 'boost',
			action: 'boost',
			identifier: String(Math.floor(Math.random() * 100000000)),
			creation_date: Math.floor(Date.now() / 1000),
			sats,
			sender_name: name,
			app_name: 'Test',
			podcast: 'Test',
			event_guid: 'Test',
			episode_guid: 'Test',
			episode: 'Test',
			isOld: false,
			isTest: true
		});
	}

	destroy(): void {
		this.destroyed = true;
		this.fetchAbort?.abort();
		this.watcher.destroy();
		this.identifiers.clear();
		this.identifierOrder = [];
	}

	private async loadStoredBoosts(): Promise<void> {
		const stored = new StoredBoosts(this.filters);
		await stored.load(
			(payment) => {
				if (!this.destroyed) this.add(payment);
			},
			() => this.destroyed,
			(controller) => {
				this.fetchAbort = controller;
			}
		);
	}

	private add(payment: BoardPayment): void {
		if (this.destroyed) return;

		if (payment.isTest) {
			this.scores.add(payment);
			this.addIdentifier(payment.identifier);
			return;
		}

		if (payment.isOld && payment.type === 'boost' && !this.loadBoosts) return;
		if (payment.isOld && payment.type === 'zap' && !this.zapEvent) return;

		if (!payment.sats || Number.isNaN(payment.sats)) return;
		if (this.identifiers.has(payment.identifier)) return;

		if (
			this.filters.excludePodcasts?.some((filter) =>
				payment.podcast?.toLowerCase().includes(filter.toLowerCase())
			)
		) {
			return;
		}

		if (this.filters.before && this.filters.before < payment.creation_date) return;
		if (this.filters.after && this.filters.after > payment.creation_date) return;

		const podcastMatch = this.filters.podcasts?.some((podcast) => {
			if (podcast === '') return payment.podcast === '';
			return payment.podcast?.toLowerCase().includes(podcast.toLowerCase());
		});
		const eventGuidMatch = this.filters.eventGuids?.some((guid) => payment.event_guid === guid);
		const episodeGuidMatch = this.filters.episodeGuids?.some(
			(guid) => payment.episode_guid === guid
		);

		if (
			payment.type === 'boost' &&
			(this.filters.podcasts || this.filters.eventGuids || this.filters.episodeGuids) &&
			!podcastMatch &&
			!eventGuidMatch &&
			!episodeGuidMatch
		) {
			return;
		}

		this.scores.add(payment);
		this.addIdentifier(payment.identifier);
	}

	private addIdentifier(identifier: string): void {
		if (this.identifiers.has(identifier)) return;
		this.identifiers.add(identifier);
		this.identifierOrder.push(identifier);
		if (this.identifierOrder.length > MAX_IDENTIFIERS) {
			const oldest = this.identifierOrder.shift();
			if (oldest !== undefined) this.identifiers.delete(oldest);
		}
	}
}

class StoredBoosts {
	constructor(private filters: BoardFilters) {}

	async load(
		callback: (payment: BoardPayment) => void,
		isCancelled: () => boolean,
		onFetch: (controller: AbortController) => void
	): Promise<void> {
		let page = 1;

		while (page <= MAX_PAGES) {
			if (isCancelled()) return;

			const query = new URLSearchParams();
			query.set('page', String(page));
			query.set('items', String(PAGE_SIZE));
			if (this.filters.podcasts) query.set('podcast', this.filters.podcasts.join(','));
			if (this.filters.eventGuids) query.set('eventGuid', this.filters.eventGuids.join(','));
			if (this.filters.episodeGuids) query.set('episodeGuid', this.filters.episodeGuids.join(','));
			if (this.filters.before) query.set('created_at_lt', String(this.filters.before));
			if (this.filters.after) query.set('created_at_gt', String(this.filters.after));

			const controller = new AbortController();
			onFetch(controller);
			const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

			let result: Response;
			try {
				result = await fetch(`${STORED_BOOSTS_URL}?${query}`, { signal: controller.signal });
			} catch (error) {
				clearTimeout(timeoutId);
				if (isCancelled()) return;
				if (isAbortError(error)) {
					console.error('Boost fetch timeout');
					return;
				}
				throw error;
			}
			clearTimeout(timeoutId);

			if (isCancelled()) return;
			if (!result.ok) {
				console.error(`HTTP error fetching boosts: ${result.status}`);
				break;
			}

			const boosts = (await result.json()) as StoredInvoice[] | null;
			if (!Array.isArray(boosts) || boosts.length === 0) break;

			boosts.sort((a, b) => (a.creation_date || 0) - (b.creation_date || 0));

			for (const invoice of boosts) {
				if (isCancelled()) return;
				if (!invoice.boostagram) continue;
				try {
					callback(paymentFromBoostagram(invoice, invoice.boostagram, true));
				} catch (error) {
					console.error('Error processing boost:', error);
				}
			}

			page++;
		}

		if (page > MAX_PAGES) {
			console.warn(`Reached max pages limit (${MAX_PAGES})`);
		}
	}
}

class NostrWatcher {
	private pool = new SimplePool();
	private profiles: Record<string, NostrProfile> = {};
	private profileQueue: Record<string, Array<(profile: NostrProfile) => void>> = {};
	private profileInterval: ReturnType<typeof setInterval> | null = null;
	private subscriptions: Array<{ cleanup: () => void; closer: { close: (reason?: string) => void } }> =
		[];
	private reconnectAttempts = new Map<string, number>();
	private reconnectTimers = new Set<ReturnType<typeof setTimeout>>();
	private subscriptionCount = 0;
	private destroyed = false;

	constructor(private relays: string[]) {
		this.profileInterval = setInterval(() => {
			void this.resolveProfiles();
		}, PROFILE_INTERVAL_MS);
	}

	subscribeBoosts(nostrPubkey: string, callback: (payment: BoardPayment) => void): void {
		if (this.destroyed) return;

		const subscriptionId = `boosts-${nostrPubkey}`;
		const parsedPubkey = parsePubkey(nostrPubkey);
		const oldState = createOldState();
		let closed = false;

		const closer = this.pool.subscribeMany(
			this.relays,
			{ authors: [parsedPubkey], kinds: [30078] } satisfies Filter,
			{
				onevent: (event) => {
					void this.onBoostEvent(event, oldState, callback);
				},
				onclose: () => {
					if (closed) return;
					closed = true;
					oldState.cleanup();
					this.scheduleReconnect(subscriptionId, 'boosts', () => {
						this.subscribeBoosts(nostrPubkey, callback);
					});
				}
			}
		);

		this.subscriptions.push({ cleanup: () => oldState.cleanup(), closer });
	}

	subscribeZaps(nostrActivity: string, callback: (payment: BoardPayment) => void): void {
		this.subscribeMultiZaps([nostrActivity], callback);
	}

	destroy(): void {
		this.destroyed = true;
		if (this.profileInterval) {
			clearInterval(this.profileInterval);
			this.profileInterval = null;
		}
		for (const timer of this.reconnectTimers) clearTimeout(timer);
		this.reconnectTimers.clear();
		for (const sub of this.subscriptions) {
			sub.cleanup();
			try {
				sub.closer.close();
			} catch {
				// Relay may already be closed.
			}
		}
		this.subscriptions = [];
		this.flushProfileQueue();
		this.profileQueue = {};
		this.profiles = {};
		this.reconnectAttempts.clear();
		this.pool.destroy();
	}

	private subscribeMultiZaps(
		nostrActivities: string[],
		callback: (payment: BoardPayment) => void
	): void {
		if (this.destroyed) return;

		const subscriptionId = `zaps-${this.subscriptionCount++}`;
		const parsedActivities = nostrActivities.map((activity) => parseActivity(activity));
		const oldState = createOldState();
		let closed = false;

		const closer = this.pool.subscribeMany(
			this.relays,
			{ '#a': parsedActivities, kinds: [9735] } satisfies Filter,
			{
				onevent: (event) => {
					void this.onZapEvent(event, oldState, callback);
				},
				onclose: () => {
					if (closed) return;
					closed = true;
					oldState.cleanup();
					this.scheduleReconnect(subscriptionId, 'zaps', () => {
						this.subscribeMultiZaps(nostrActivities, callback);
					});
				}
			}
		);

		this.subscriptions.push({ cleanup: () => oldState.cleanup(), closer });
	}

	private scheduleReconnect(subscriptionId: string, label: string, resubscribe: () => void): void {
		if (this.destroyed) return;

		const attempts = this.reconnectAttempts.get(subscriptionId) || 0;
		if (attempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error(`Max reconnection attempts reached for ${label} subscription`);
			return;
		}

		this.reconnectAttempts.set(subscriptionId, attempts + 1);
		const timer = setTimeout(() => {
			this.reconnectTimers.delete(timer);
			if (!this.destroyed) resubscribe();
		}, RECONNECT_DELAY_MS * 2 ** attempts);
		this.reconnectTimers.add(timer);
	}

	private async onBoostEvent(
		event: Event,
		oldState: OldState,
		callback: (payment: BoardPayment) => void
	): Promise<void> {
		if (this.destroyed) return;

		try {
			const invoice = JSON.parse(event.content) as StoredInvoice;
			oldState.markSeen();
			if (!invoice?.boostagram) return;
			callback(paymentFromBoostagram(invoice, invoice.boostagram, oldState.isOld()));
		} catch (error) {
			console.error('Error processing boost event:', error);
		}
	}

	private async onZapEvent(
		event: Event,
		oldState: OldState,
		callback: (payment: BoardPayment) => void
	): Promise<void> {
		if (this.destroyed) return;

		try {
			oldState.markSeen();
			const tags = tagsByName(event.tags);
			if (!tags.description?.[0] || !tags.bolt11?.[0]) {
				console.warn('Missing required tags in zap event');
				return;
			}

			const zapRequest = JSON.parse(tags.description[0]) as { pubkey?: string };
			const valueMsat = getMsatsFromBolt11(tags.bolt11[0]);
			if (!valueMsat) {
				console.warn('Could not parse sats from bolt11');
				return;
			}

			const profile = zapRequest.pubkey ? await this.getNostrProfile(zapRequest.pubkey) : {};
			if (this.destroyed) return;

			callback({
				type: 'zap',
				action: 'zap',
				identifier: event.id,
				creation_date: event.created_at,
				sender_name: profile.display_name || profile.name || 'Anonymous',
				app_name: 'Nostr',
				podcast: 'Nostr',
				event_guid: null,
				episode_guid: null,
				episode: null,
				sats: Math.floor(valueMsat / 1000),
				message: event.content,
				isOld: oldState.isOld()
			});
		} catch (error) {
			console.error('Error processing zap event:', error);
		}
	}

	private getNostrProfile(pubkey: string): Promise<NostrProfile> {
		const cached = this.profiles[pubkey];
		if (cached) return Promise.resolve(cached);
		if (this.destroyed) return Promise.resolve({});

		return new Promise((resolve) => {
			if (!this.profileQueue[pubkey]) this.profileQueue[pubkey] = [];
			this.profileQueue[pubkey].push(resolve);
		});
	}

	private async resolveProfiles(): Promise<void> {
		if (this.destroyed) return;
		const pubkeys = Object.keys(this.profileQueue);
		if (!pubkeys.length) return;

		try {
			const events = await this.pool.querySync(this.relays, { authors: pubkeys, kinds: [0] });
			if (this.destroyed) {
				this.flushProfileQueue();
				return;
			}

			for (const event of events) {
				try {
					this.profiles[event.pubkey] = JSON.parse(event.content) as NostrProfile;
				} catch (error) {
					console.error('Error parsing profile content:', error);
					this.profiles[event.pubkey] = {};
				}
			}

			for (const pubkey of pubkeys) {
				const resolvers = this.profileQueue[pubkey];
				if (!resolvers) continue;
				delete this.profileQueue[pubkey];
				const profile = this.profiles[pubkey] || {};
				for (const resolve of resolvers) resolve(profile);
			}
		} catch (error) {
			if (!this.destroyed) console.error('Error resolving profiles:', error);
		}
	}

	private flushProfileQueue(): void {
		for (const pubkey of Object.keys(this.profileQueue)) {
			const resolvers = this.profileQueue[pubkey];
			delete this.profileQueue[pubkey];
			for (const resolve of resolvers) resolve(this.profiles[pubkey] || {});
		}
	}
}

interface OldState {
	markSeen: () => void;
	isOld: () => boolean;
	cleanup: () => void;
}

function createOldState(): OldState {
	let isOld = true;
	let timer: ReturnType<typeof setTimeout> | null = null;

	return {
		markSeen() {
			if (timer) clearTimeout(timer);
			if (isOld) {
				timer = setTimeout(() => {
					isOld = false;
				}, OLD_EVENT_WINDOW_MS);
			}
		},
		isOld: () => isOld,
		cleanup() {
			if (timer) clearTimeout(timer);
			timer = null;
		}
	};
}

function paymentFromBoostagram(
	invoice: StoredInvoice,
	boost: Boostagram,
	isOld: boolean
): BoardPayment {
	return {
		type: 'boost',
		action: boost.action || 'unknown',
		identifier: invoice.identifier || '',
		creation_date: invoice.creation_date || 0,
		sender_name: boost.sender_name || 'Anonymous',
		app_name: boost.app_name || 'Unknown',
		podcast: boost.podcast || 'Unknown',
		event_guid: boost.eventGuid || null,
		episode_guid: boost.episode_guid || null,
		episode: boost.episode || null,
		sats: Math.floor((boost.value_msat_total ?? Number.NaN) / 1000),
		message: boost.message,
		isOld
	};
}

function parseTimeFilter(value: string | number): number {
	if (typeof value === 'number') return value;
	if (/^\d+$/.test(value)) return parseInt(value, 10);
	return Math.floor(new Date(value).getTime() / 1000);
}

function parsePubkey(pubkey: string): string {
	if (!pubkey.includes('npub')) return pubkey;
	try {
		const decoded = nip19.decode(pubkey);
		if (decoded.type === 'npub') return decoded.data;
		return pubkey;
	} catch (error) {
		console.error('Error parsing pubkey:', error);
		return pubkey;
	}
}

function parseActivity(addr: string): string {
	if (!addr.includes('naddr')) return addr;
	try {
		const decoded = nip19.decode(addr);
		if (decoded.type !== 'naddr') return addr;
		const { kind, pubkey, identifier } = decoded.data;
		return [kind, pubkey, identifier].join(':');
	} catch (error) {
		console.error('Error parsing activity:', error);
		return addr;
	}
}

function tagsByName(tags: string[][]): Record<string, string[]> {
	const result: Record<string, string[]> = {};
	for (const tag of tags) {
		const [name, value] = tag;
		if (!name || value === undefined) continue;
		if (!result[name]) result[name] = [];
		result[name].push(value);
	}
	return result;
}

function getMsatsFromBolt11(bolt11: string): number | null {
	const multipliers: Record<string, number> = {
		m: 100000000,
		u: 100000,
		n: 100,
		p: 0.1
	};

	try {
		const matches = bolt11.match(/^ln\w+?(\d+)([a-zA-Z]?)/);
		if (!matches) return null;
		const amount = parseInt(matches[1], 10);
		const multiplier = matches[2] ? multipliers[matches[2]] || 1 : 1;
		return amount * multiplier;
	} catch (error) {
		console.error('Error parsing bolt11:', error);
		return null;
	}
}

function isAbortError(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
