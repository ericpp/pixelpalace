import buildBoostPayments from './buildBoostPayments';

const KEYSEND_PUBKEY = /^[0-9a-fA-F]{66}$/;

async function resolveKeysendTarget(address) {
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

	const info = await metaRes.json();
	if (info.status !== 'OK' || !info.pubkey) {
		throw new Error(`Keysend metadata unavailable for ${address}`);
	}

	const extraCustomRecords = {};
	if (info.customData?.[0]?.customKey != null) {
		extraCustomRecords[String(info.customData[0].customKey)] = info.customData[0].customValue;
	}

	return { destination: info.pubkey, extraCustomRecords };
}

async function fetchLnAddressInvoice(address, amountMsats) {
	const at = address.lastIndexOf('@');
	const user = address.slice(0, at);
	const domain = address.slice(at + 1);
	const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(user)}`);
	if (!metaRes.ok) {
		throw new Error(`LNURL metadata fetch failed: ${metaRes.status}`);
	}
	const meta = await metaRes.json();
	if (!meta.callback) {
		throw new Error('LNURL metadata missing callback');
	}
	const callback = new URL(meta.callback);
	callback.searchParams.set('amount', String(amountMsats));
	const invoiceRes = await fetch(callback.toString());
	if (!invoiceRes.ok) {
		throw new Error(`LNURL invoice fetch failed: ${invoiceRes.status}`);
	}
	const invoice = await invoiceRes.json();
	if (!invoice.pr) {
		throw new Error('LNURL invoice missing payment request');
	}
	return invoice.pr;
}

async function payDestination(provider, payment) {
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
}) {
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
