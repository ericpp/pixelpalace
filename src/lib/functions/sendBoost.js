import { getAlbyServer } from '$/stores';
import buildBoostPayments from './buildBoostPayments';

export default async function sendBoost({ block, satAmount, boostagram, senderName, isDefault }) {
	const payments = buildBoostPayments({ block, satAmount, boostagram, senderName, isDefault });

	const res = await fetch(getAlbyServer() + '/api/alby/handlePayments', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payments)
	});

	const data = await res.json();
	console.log(data);
	return data;
}
