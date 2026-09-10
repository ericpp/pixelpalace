import type { Block, BoostPayment, PaymentResult, WalletProvider } from '$lib/types';
import buildBoostPayments from './buildBoostPayments';

const KEYSEND_PUBKEY = /^[0-9a-fA-F]{66}$/;

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

async function fetchLnAddressInvoice(address: string, amountMsats: number): Promise<string> {
	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`);
	if (!metaRes.ok) {
		throw new Error(`LNURL metadata fetch failed: ${metaRes.status}`);
	}
	const meta = (await metaRes.json()) as { callback?: string };
	if (!meta.callback) {
		throw new Error('LNURL metadata missing callback');
	}
	const callback = new URL(meta.callback);
	callback.searchParams.set('amount', String(amountMsats));
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

async function payDestination(provider: WalletProvider, payment: BoostPayment): Promise<unknown> {
	const { type, destination, amount, customRecords } = payment;
	const shouldKeysend =
		type === 'node' || KEYSEND_PUBKEY.test(destination) || destination.includes('@');

	if (shouldKeysend) {
		if (!provider.keysend) {
			throw new Error('Connected wallet does not support keysend payments');
		}

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

	if (type === 'lnaddress' || destination.includes('@')) {
		const invoice = await fetchLnAddressInvoice(destination, amount * 1000);
		console.log('lnaddress invoice', {
			invoice,
			amount,
			destination
		});
		return provider.sendPayment(invoice);
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

	const payments = buildBoostPayments({ block, satAmount, boostagram, senderName, isDefault });
	let successCount = 0;
	let failureCount = 0;

	for (const payment of payments) {
		try {
			await payDestination(provider, payment);
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
