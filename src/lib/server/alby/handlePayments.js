import processPayments from './processPayments.js';

async function resolveLnaddressSplits(splits) {
	return Promise.all(
		splits.map(async (split) => {
			const [name, server] = split.destination.split('@');
			const paymentUrl = `https://${server}/.well-known/keysend/${encodeURIComponent(name)}`;

			try {
				const res = await fetch(paymentUrl);
				const data = await res.json();
				if (data.pubkey) {
					Object.assign(split, { type: 'node', destination: data.pubkey });
					if (data?.customData?.customKey) {
						split.customRecords[data.customData.customKey] = data.customData.customValue;
					}
				}
			} catch {
				// Keep as lnaddress for bolt11 fallback.
			}

			return split;
		})
	);
}

export default async function handlePayments(accessToken, body) {
	const payments = [].concat(body);
	const keysends = payments.filter((v) => v.type === 'node');
	const lnurlp = await resolveLnaddressSplits(payments.filter((v) => v.type === 'lnaddress'));

	keysends.push(...lnurlp.filter((v) => v.type === 'node'));
	const remainingLnurl = lnurlp.filter((v) => v.type === 'lnaddress');
	const splits = [...keysends, ...remainingLnurl];
	const completedPayments = await processPayments(accessToken, splits);

	return { splits, completedPayments };
}
