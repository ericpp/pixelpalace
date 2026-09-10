import { getAlbyServer } from '$/stores';
import type { PaymentResult, WalletProvider } from '$lib/types';
import type { ZapInvoice } from '$lib/nostr/zap';

function toBolt11Payments(invoices: ZapInvoice[]) {
	return invoices.map((inv) => ({
		type: 'bolt11',
		destination: inv.invoice,
		amount: inv.amount,
		customRecords: {},
		name: inv.name,
		destIndex: inv.destIndex
	}));
}

export async function sendZapAlby(invoices: ZapInvoice[]): Promise<unknown> {
	const res = await fetch(getAlbyServer() + '/api/alby/handlePayments', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(toBolt11Payments(invoices))
	});

	const data = (await res.json()) as {
		message?: string;
		completedPayments?: Array<{ success?: boolean; err?: string }>;
	};
	if (!res.ok) {
		throw new Error(data.message || 'Zap payment failed');
	}

	const failures = (data.completedPayments || []).filter((payment) => !payment.success);
	if (failures.length) {
		throw new Error(failures[0]?.err || 'Zap payment failed');
	}

	return data;
}

export async function sendZapWallet({
	provider,
	invoices,
	onPaymentResult
}: {
	provider: WalletProvider | null | undefined;
	invoices: ZapInvoice[];
	onPaymentResult?: (result: PaymentResult) => void;
}): Promise<{ payments: number; successCount: number; failureCount: number }> {
	if (!provider) {
		throw new Error('Wallet is not connected');
	}

	let successCount = 0;
	let failureCount = 0;

	for (const inv of invoices) {
		try {
			await provider.sendPayment(inv.invoice);
			successCount += 1;
			onPaymentResult?.({
				destIndex: inv.destIndex,
				destination: inv.invoice,
				name: inv.name,
				status: 'success'
			});
		} catch (err) {
			failureCount += 1;
			console.error('Zap payment failed', inv.name, inv.amount, err);
			onPaymentResult?.({
				destIndex: inv.destIndex,
				destination: inv.invoice,
				name: inv.name,
				status: 'failed',
				error: err
			});
		}
	}

	return { payments: invoices.length, successCount, failureCount };
}
