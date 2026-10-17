import { fetchLnurlInvoice, hasPublicLnurlTarget, isBoostboxEnabled, postBoostbox } from '$/stores';
import type { Block, BoostPayment, PaymentResult, WalletProvider } from '$lib/types';
import { boostboxMetadata } from './boostboxMetadata';
import buildBoostPayments from './buildBoostPayments';

/** `rss::payment::<action> <url>` — kept whole when a comment must be shortened. */
const BOOST_LINK = /^(rss::payment::\S+\s+\S+)/;

function fitLnurlComment(desc: string, commentAllowed: number): string | undefined {
	if (commentAllowed <= 0) return undefined;
	if (desc.length <= commentAllowed) return desc;

	const prefix = desc.match(BOOST_LINK)?.[1];
	if (!prefix || prefix.length > commentAllowed) return undefined;
	return (prefix + desc.slice(prefix.length, commentAllowed)).trimEnd();
}

const KEYSEND_PUBKEY = /^[0-9a-fA-F]{66}$/;

/** NWC get_info lists pay_keysend; Bitcoin Connect maps that to payKeysend or keysend. */
const KEYSEND_METHOD = /^(keysend|paykeysend|pay_keysend)$/i;

/**
 * The NWC WebLN provider always exposes keysend(), even when the wallet's
 * get_info methods omit pay_keysend. Trust the advertised method list.
 */
async function walletSupportsKeysend(provider: WalletProvider): Promise<boolean> {
	if (typeof provider.keysend !== 'function') return false;
	if (!provider.getInfo) return true;

	try {
		const info = await provider.getInfo();
		const methods = info?.methods;
		if (!methods?.length) return true;
		return methods.some((method) => KEYSEND_METHOD.test(method));
	} catch {
		return true;
	}
}

async function resolveKeysendTarget(address: string): Promise<{
	destination: string;
	extraCustomRecords: Record<string, string>;
}> {
	if (!address.includes('@')) {
		return { destination: address, extraCustomRecords: {} };
	}

	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	const metaRes = await fetch(
		`https://${domain}/.well-known/keysend/${encodeURIComponent(user)}`
	);

	if (!metaRes.ok) {
		throw new Error(`Keysend lookup failed for ${address}: ${metaRes.status}`);
	}

	const info = (await metaRes.json()) as {
		status?: string;
		pubkey?: string;
		customData?: Array<{ customKey?: string | number; customValue?: string }>;
	};
	if (info.status !== 'OK' || !info.pubkey) {
		throw new Error(`Keysend metadata unavailable for ${address}`);
	}

	const extraCustomRecords: Record<string, string> = {};
	if (info.customData?.[0]?.customKey != null && info.customData[0].customValue != null) {
		extraCustomRecords[String(info.customData[0].customKey)] = String(
			info.customData[0].customValue
		);
	}

	return { destination: info.pubkey, extraCustomRecords };
}

async function fetchLnAddressInvoice(
	address: string,
	amountMsats: number,
	comment?: string
): Promise<string> {
	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`);
	if (!metaRes.ok) {
		throw new Error(`LNURL metadata fetch failed: ${metaRes.status}`);
	}
	const meta = (await metaRes.json()) as { callback?: string; commentAllowed?: number };
	if (!meta.callback) {
		throw new Error('LNURL metadata missing callback');
	}
	const callback = new URL(meta.callback);
	callback.searchParams.set('amount', String(amountMsats));
	if (comment) {
		const allowed = Number(meta.commentAllowed) || 0;
		const fitted = fitLnurlComment(comment, allowed);
		if (fitted) {
			callback.searchParams.set('comment', fitted);
		} else {
			console.warn('LNURL comment not sent; commentAllowed too small', {
				address,
				commentAllowed: allowed
			});
		}
	}
	const invoiceRes = await fetch(callback.toString());
	if (!invoiceRes.ok) {
		throw new Error(`LNURL invoice fetch failed: ${invoiceRes.status}`);
	}
	const invoice = (await invoiceRes.json()) as { pr?: string };
	if (!invoice.pr) {
		throw new Error('LNURL invoice missing payment request');
	}
	return invoice.pr;
}

async function payLnAddressInvoice(
	provider: WalletProvider,
	destination: string,
	amount: number,
	comment?: string
): Promise<unknown> {
	const invoice = await fetchLnAddressInvoice(destination, amount * 1000, comment);
	console.log('lnaddress invoice', {
		invoice,
		amount,
		destination,
		comment
	});
	return provider.sendPayment(invoice);
}

async function payBoostboxSplit(
	provider: WalletProvider,
	payment: BoostPayment,
	group?: string
): Promise<unknown> {
	const { type, destination, amount } = payment;
	const isLnAddress = type === 'lnaddress' || destination.includes('@');
	if (!isLnAddress) {
		throw new Error('Connected wallet does not support keysend payments');
	}

	let comment: string | undefined;
	try {
		const stored = await postBoostbox(boostboxMetadata(payment, group));
		comment = stored.desc;
	} catch (err) {
		console.warn('BoostBox store failed, paying without metadata', destination, err);
	}

	return payLnAddressInvoice(provider, destination, amount, comment);
}

async function payDestination(
	provider: WalletProvider,
	payment: BoostPayment,
	supportsKeysend: boolean,
	useBoostbox: boolean,
	boostGroup?: string
): Promise<unknown> {
	if (useBoostbox) {
		return payBoostboxSplit(provider, payment, boostGroup);
	}

	const { type, destination, amount, customRecords } = payment;
	const isLnAddress = type === 'lnaddress' || destination.includes('@');
	const isNode = type === 'node' || KEYSEND_PUBKEY.test(destination);

	if (supportsKeysend && provider.keysend && (isNode || isLnAddress)) {
		const { destination: keysendDestination, extraCustomRecords } =
			await resolveKeysendTarget(destination);

		const params = {
			destination: keysendDestination,
			amount,
			customRecords: { ...customRecords, ...extraCustomRecords }
		};
		console.log('keysend params', params);
		return provider.keysend(params);
	}

	if (isLnAddress) {
		return payLnAddressInvoice(provider, destination, amount);
	}

	if (isNode) {
		throw new Error('Connected wallet does not support keysend payments');
	}

	throw new Error(`Unsupported payment destination type: ${type || 'unknown'}`);
}

export default async function sendBoostWallet({
	provider,
	block,
	satAmount,
	boostagram,
	senderName,
	isDefault,
	onPaymentResult
}: {
	provider: WalletProvider | null | undefined;
	block: Block;
	satAmount: number;
	boostagram: string;
	senderName: string;
	isDefault?: boolean;
	onPaymentResult?: (result: PaymentResult) => void;
}): Promise<{ payments: number; successCount: number; failureCount: number }> {
	if (!provider) {
		throw new Error('Wallet is not connected');
	}

	const supportsKeysend = await walletSupportsKeysend(provider);
	const useBoostbox = !supportsKeysend && (await isBoostboxEnabled());
	if (!supportsKeysend && !useBoostbox && hasPublicLnurlTarget()) {
		const invoice = await fetchLnurlInvoice(block.eventGuid, {
			amount: satAmount * 1000,
			comment: boostagram,
			senderName,
			blockGuid: block.blockGuid
		});
		if (!invoice.pr) {
			throw new Error('LNURL invoice missing payment request');
		}
		console.log('public lnurl invoice', { amount: satAmount, invoice: invoice.pr });
		await provider.sendPayment(invoice.pr);
		return { payments: 1, successCount: 1, failureCount: 0 };
	}

	const payments = buildBoostPayments({ block, satAmount, boostagram, senderName, isDefault });
	const boostGroup = useBoostbox ? crypto.randomUUID() : undefined;
	let successCount = 0;
	let failureCount = 0;

	for (const payment of payments) {
		try {
			await payDestination(provider, payment, supportsKeysend, useBoostbox, boostGroup);
			successCount += 1;
			onPaymentResult?.({
				destIndex: payment.destIndex,
				destination: payment.destination,
				name: payment.name,
				status: 'success'
			});
		} catch (err) {
			failureCount += 1;
			console.error('Split payment failed', payment.destination, payment.amount, err);
			onPaymentResult?.({
				destIndex: payment.destIndex,
				destination: payment.destination,
				name: payment.name,
				status: 'failed',
				error: err
			});
		}
	}

	return { payments: payments.length, successCount, failureCount };
}
