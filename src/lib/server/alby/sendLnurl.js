export default async function sendLnurl({ accessToken, recipient }) {
	try {
		if (!recipient.amount) {
			return {
				success: true,
				recipient,
				paymentData: { amount: 0, status: 'no sats sent, amount too low' }
			};
		}

		const [name, server] = recipient.destination.split('@');
		const paymentUrl = `https://${server}/.well-known/lnurlp/${encodeURIComponent(name)}`;

		const metaRes = await fetch(paymentUrl);
		if (!metaRes.ok) {
			throw new Error(`LNURL metadata fetch failed: ${metaRes.status}`);
		}

		const meta = await metaRes.json();
		if (!meta.callback) {
			throw new Error('Callback URL missing in LNURLP response');
		}

		const callbackUrl = new URL(meta.callback);
		callbackUrl.searchParams.set('amount', String(recipient.amount * 1000));

		const invoiceRes = await fetch(callbackUrl.toString());
		if (!invoiceRes.ok) {
			throw new Error(`LNURL invoice fetch failed: ${invoiceRes.status}`);
		}

		const invoiceData = await invoiceRes.json();
		const invoice = invoiceData.pr;
		if (!invoice) {
			throw new Error('LNURL invoice missing pr');
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
		console.log('LNURL Payment Error:', error.message || error);
		return { success: false, recipient, err: error.message || String(error) };
	}
}
