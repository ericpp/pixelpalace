import sendKeysend from './sendKeysend';
import sendLnurl from './sendLnurl';
import sendBolt11 from './sendBolt11';
import type { BoostPayment, PaymentAttemptResult } from '$lib/types';

export default async function processPayments(
	accessToken: string,
	splits: BoostPayment[]
): Promise<PaymentAttemptResult[]> {
	const paymentAttempts = splits.map((recipient) => {
		if (recipient?.type === 'node') {
			return sendKeysend({ accessToken, recipient });
		}
		if (recipient?.type === 'lnaddress') {
			return sendLnurl({ accessToken, recipient });
		}
		if (recipient?.type === 'bolt11') {
			return sendBolt11({ accessToken, recipient });
		}
		return Promise.resolve({ status: 'skipped', recipient });
	});

	return Promise.all(paymentAttempts);
}
