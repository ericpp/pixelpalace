import { finalizeEvent, generateSecretKey, SimplePool, nip19 } from 'nostr-tools';
import type { Event, EventTemplate } from 'nostr-tools';
import type { ResolvedNostrEvent } from '$lib/types';

export interface ZapSplitPreview {
	pubkey: string;
	name: string;
	amount: number;
	destIndex: number;
}

export interface ZapInvoice extends ZapSplitPreview {
	invoice: string;
	usedNostr: boolean;
}

interface LnurlPayMeta {
	callback?: string;
	allowsNostr?: boolean;
	nostrPubkey?: string;
	commentAllowed?: number;
	minSendable?: number;
	maxSendable?: number;
	reason?: string;
	status?: string;
}

interface LnurlInvoice {
	pr?: string;
	reason?: string;
	status?: string;
}

function shortNpub(pubkey: string): string {
	if (!pubkey) return 'Recipient';
	try {
		const npub = nip19.npubEncode(pubkey);
		return `${npub.slice(0, 12)}…`;
	} catch {
		return `${pubkey.slice(0, 8)}…`;
	}
}

function profileName(content: string): string {
	try {
		const profile = JSON.parse(content) as { display_name?: string; name?: string };
		return profile.display_name || profile.name || '';
	} catch {
		return '';
	}
}

export function getZapSplitRecipients(target: ResolvedNostrEvent, satAmount: number): ZapSplitPreview[] {
	const zapTags = target.tags.filter((tag) => tag[0] === 'zap' && tag[1]);
	if (!zapTags.length) {
		return [
			{
				pubkey: target.pubkey,
				name: target.title || 'Event author',
				amount: satAmount,
				destIndex: 0
			}
		];
	}

	const parsed = zapTags.map((tag) => {
		const rawWeight = tag[3];
		const weight = rawWeight != null && rawWeight !== '' ? Number(rawWeight) : NaN;
		return {
			pubkey: tag[1],
			weight: Number.isFinite(weight) ? weight : null
		};
	});

	const anyWeights = parsed.some((item) => item.weight != null);
	const eligible = anyWeights
		? parsed.filter((item) => item.weight != null && item.weight > 0)
		: parsed.map((item) => ({ ...item, weight: 1 }));
	const sum = eligible.reduce((total, item) => total + (item.weight || 0), 0);
	if (!sum) {
		return [
			{
				pubkey: target.pubkey,
				name: target.title || 'Event author',
				amount: satAmount,
				destIndex: 0
			}
		];
	}

	const recipients: ZapSplitPreview[] = [];
	let remaining = satAmount;
	for (let i = 0; i < eligible.length; i += 1) {
		const isLast = i === eligible.length - 1;
		const amount = isLast ? remaining : Math.round((satAmount * (eligible[i].weight || 0)) / sum);
		remaining -= amount;
		if (amount >= 1) {
			recipients.push({
				pubkey: eligible[i].pubkey,
				name: shortNpub(eligible[i].pubkey),
				amount,
				destIndex: recipients.length
			});
		}
	}
	return recipients;
}

async function fetchKind0(pubkey: string, relays: string[]): Promise<Event | null> {
	const pool = new SimplePool();
	try {
		return await pool.get(relays, { kinds: [0], authors: [pubkey] }, { maxWait: 8000 });
	} finally {
		pool.destroy();
	}
}

async function decodeLud06(lud06: string): Promise<string | null> {
	try {
		const { bech32 } = await import('@scure/base');
		const { words } = bech32.decode(lud06.toLowerCase() as `${string}1${string}`, 2000);
		return new TextDecoder().decode(Uint8Array.from(bech32.fromWords(words)));
	} catch {
		return null;
	}
}

async function lightningUrlFromProfile(content: string): Promise<string | null> {
	try {
		const profile = JSON.parse(content) as { lud16?: string; lud06?: string };
		if (profile.lud16 && profile.lud16.includes('@')) {
			const at = profile.lud16.lastIndexOf('@');
			const name = profile.lud16.slice(0, at);
			const domain = profile.lud16.slice(at + 1);
			return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
		}
		if (profile.lud06) {
			return decodeLud06(profile.lud06);
		}
	} catch {
		return null;
	}
	return null;
}

async function fetchLnurlJson(targetUrl: string): Promise<unknown> {
	const res = await fetch(`/api/lnurl?url=${encodeURIComponent(targetUrl)}`);
	if (!res.ok) {
		throw new Error(`LNURL fetch failed: ${res.status}`);
	}
	return res.json();
}

function makeZapRequest(target: ResolvedNostrEvent, recipientPubkey: string, amountMsats: number, comment: string): EventTemplate {
	const relays = target.relays.slice(0, 8);
	const tags: string[][] = [
		['p', recipientPubkey],
		['amount', String(amountMsats)],
		['relays', ...relays]
	];
	if (target.eventId) {
		tags.push(['e', target.eventId]);
	}
	if (target.address) {
		tags.push(['a', target.address]);
	}
	if (target.kind) {
		tags.push(['k', String(target.kind)]);
	}
	return {
		kind: 9734,
		created_at: Math.round(Date.now() / 1000),
		content: comment,
		tags
	};
}

async function signZapRequest(template: EventTemplate): Promise<Event> {
	if (typeof window !== 'undefined' && window.nostr?.signEvent) {
		return window.nostr.signEvent(template);
	}
	return finalizeEvent(template, generateSecretKey());
}

async function requestInvoice(callback: string, amountMsats: number, comment: string, zapRequest?: Event): Promise<{ invoice: string; usedNostr: boolean }> {
	const withNostr = new URL(callback);
	withNostr.searchParams.set('amount', String(amountMsats));
	if (comment) {
		withNostr.searchParams.set('comment', comment);
	}
	if (zapRequest) {
		withNostr.searchParams.set('nostr', JSON.stringify(zapRequest));
		try {
			const data = (await fetchLnurlJson(withNostr.toString())) as LnurlInvoice;
			if (data.pr) {
				return { invoice: data.pr, usedNostr: true };
			}
		} catch {
			// Fall through to a plain LNURL invoice.
		}
	}

	const plain = new URL(callback);
	plain.searchParams.set('amount', String(amountMsats));
	if (comment) {
		plain.searchParams.set('comment', comment);
	}
	const data = (await fetchLnurlJson(plain.toString())) as LnurlInvoice;
	if (!data.pr) {
		throw new Error(data.reason || 'LNURL invoice missing payment request');
	}
	return { invoice: data.pr, usedNostr: false };
}

async function invoiceForRecipient(
	target: ResolvedNostrEvent,
	recipient: ZapSplitPreview,
	comment: string
): Promise<ZapInvoice> {
	if (!recipient.pubkey) {
		throw new Error('Nostr event has no recipient pubkey yet');
	}

	const profile = await fetchKind0(recipient.pubkey, target.relays);
	const name = (profile && profileName(profile.content)) || recipient.name;
	const lnurl = profile ? await lightningUrlFromProfile(profile.content) : null;
	if (!lnurl) {
		throw new Error(`No lightning address for ${name}`);
	}

	const meta = (await fetchLnurlJson(lnurl)) as LnurlPayMeta;
	if (!meta.callback) {
		throw new Error(meta.reason || `LNURL callback missing for ${name}`);
	}

	const amountMsats = recipient.amount * 1000;
	if (meta.minSendable != null && amountMsats < meta.minSendable) {
		throw new Error(`Zap is below the minimum for ${name}`);
	}
	if (meta.maxSendable != null && amountMsats > meta.maxSendable) {
		throw new Error(`Zap is above the maximum for ${name}`);
	}

	const trimmedComment =
		meta.commentAllowed && comment.length > meta.commentAllowed
			? comment.slice(0, meta.commentAllowed)
			: comment;

	let zapRequest: Event | undefined;
	if (meta.allowsNostr) {
		zapRequest = await signZapRequest(makeZapRequest(target, recipient.pubkey, amountMsats, trimmedComment));
	}

	const { invoice, usedNostr } = await requestInvoice(meta.callback, amountMsats, trimmedComment, zapRequest);
	return {
		...recipient,
		name,
		invoice,
		usedNostr
	};
}

export async function createZapInvoices({
	target,
	satAmount,
	comment
}: {
	target: ResolvedNostrEvent;
	satAmount: number;
	comment: string;
}): Promise<ZapInvoice[]> {
	const recipients = getZapSplitRecipients(target, satAmount);
	const results = await Promise.allSettled(
		recipients.map((recipient) => invoiceForRecipient(target, recipient, comment))
	);

	const invoices: ZapInvoice[] = [];
	const errors: string[] = [];
	for (const result of results) {
		if (result.status === 'fulfilled') {
			invoices.push(result.value);
		} else {
			errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
		}
	}

	if (!invoices.length) {
		throw new Error(errors[0] || 'Could not create a zap invoice for this event');
	}

	return invoices;
}
