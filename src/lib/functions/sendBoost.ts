import { getAlbyServer } from '$/stores';
import type { Block, PaymentAttemptResult } from '$lib/types';
import buildBoostPayments from './buildBoostPayments';

export interface AlbyBoostResult {
	completedPayments?: PaymentAttemptResult[];
	message?: string;
}

export default async function sendBoost({
	block,
	satAmount,
	boostagram,
	senderName,
	isDefault
}: {
	block: Block;
	satAmount: number;
	boostagram: string;
	senderName: string;
	isDefault?: boolean;
}): Promise<AlbyBoostResult> {
	const payments = buildBoostPayments({ block, satAmount, boostagram, senderName, isDefault });

	const res = await fetch(getAlbyServer() + '/api/alby/handlePayments', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payments)
	});

	const data = (await res.json()) as AlbyBoostResult;
	console.log(data);
	if (!res.ok) {
		throw new Error(data.message || 'Boost payment failed');
	}
	return data;
}
