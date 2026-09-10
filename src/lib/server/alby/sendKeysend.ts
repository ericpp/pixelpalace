import type { BoostPayment, PaymentAttemptResult } from '$lib/types';

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export default async function sendKeysend({
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

		const res = await fetch('https://api.getalby.com/payments/keysend', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(recipient)
		});

		if (!res.ok) {
			const err = await res.text();
			console.log('Keysend Payment Error:', err);
			return { success: false, recipient, err };
		}

		const paymentData = await res.json();
		return { success: true, recipient, paymentData };
	} catch (error) {
		const message = errorMessage(error);
		console.log('Keysend Payment Error:', message);
		return { success: false, recipient, err: message };
	}
}
