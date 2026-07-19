import sendKeysend from './sendKeysend.js';
import sendLnurl from './sendLnurl.js';

export default async function processPayments(accessToken, splits) {
	const paymentAttempts = splits.map((recipient) => {
		if (recipient?.type === 'node') {
			return sendKeysend({ accessToken, recipient });
		}
		if (recipient?.type === 'lnaddress') {
			return sendLnurl({ accessToken, recipient });
		}
		return Promise.resolve({ status: 'skipped', recipient });
	});

	return Promise.all(paymentAttempts);
}
