import processPayments from './processPayments';
import type { BoostPayment } from '$lib/types';

async function resolveLnaddressSplits(splits: BoostPayment[]): Promise<BoostPayment[]> {
	return Promise.all(
		splits.map(async (split) => {
			const [name, server] = split.destination.split('@');
			const paymentUrl = `https://${server}/.well-known/keysend/${encodeURIComponent(name)}`;

			try {
				const res = await fetch(paymentUrl);
				const data = (await res.json()) as {
					pubkey?: string;
					customData?: { customKey?: string | number; customValue?: string };
				};
				if (data.pubkey) {
					Object.assign(split, { type: 'node', destination: data.pubkey });
					if (data?.customData?.customKey != null && data.customData.customValue != null) {
						split.customRecords[String(data.customData.customKey)] = String(
							data.customData.customValue
						);
					}
				}
			} catch {
				// Keep as lnaddress for bolt11 fallback.
			}

			return split;
		})
	);
}

export default async function handlePayments(accessToken: string, body: BoostPayment | BoostPayment[]) {
	const payments = ([] as BoostPayment[]).concat(body);
	const keysends = payments.filter((v) => v.type === 'node');
	const lnurlp = await resolveLnaddressSplits(payments.filter((v) => v.type === 'lnaddress'));

	keysends.push(...lnurlp.filter((v) => v.type === 'node'));
	const remainingLnurl = lnurlp.filter((v) => v.type === 'lnaddress');
	const bolt11s = payments.filter((v) => v.type === 'bolt11');
	const splits = [...keysends, ...remainingLnurl, ...bolt11s];
	const completedPayments = await processPayments(accessToken, splits);

	return { splits, completedPayments };
}
