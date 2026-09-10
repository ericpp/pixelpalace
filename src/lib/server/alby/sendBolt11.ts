import type { BoostPayment, PaymentAttemptResult } from '$lib/types';

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export default async function sendBolt11({
	accessToken,
	recipient
}: {
	accessToken: string;
	recipient: BoostPayment;
}): Promise<PaymentAttemptResult> {
	try {
		if (!recipient.amount) {
			return {
				success: true,
				recipient,
				paymentData: { amount: 0, status: 'no sats sent, amount too low' }
			};
		}

		const invoice = recipient.destination;
		if (!invoice) {
			throw new Error('Missing bolt11 invoice');
		}

		const paymentRes = await fetch('https://api.getalby.com/payments/bolt11', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ invoice })
		});

		if (!paymentRes.ok) {
			const err = await paymentRes.text();
			throw new Error(err);
		}

		const paymentData = await paymentRes.json();
		return { success: true, recipient, paymentData };
	} catch (error) {
		const message = errorMessage(error);
		console.log('Bolt11 Payment Error:', message);
		return { success: false, recipient, err: message };
	}
}
