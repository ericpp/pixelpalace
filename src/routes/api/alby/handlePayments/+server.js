import { json } from '@sveltejs/kit';
import { getSessionFromCookie } from '$lib/server/alby/session.js';
import { getAwtCookie } from '$lib/server/alby/cookies.js';
import handlePayments from '$lib/server/alby/handlePayments.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies, request }) {
	const session = getSessionFromCookie(getAwtCookie(cookies));

	if (!session?.access_token) {
		return json({ message: 'Not authenticated' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const result = await handlePayments(session.access_token, body);
		return json(result);
	} catch (err) {
		console.log('handlePayment Error:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
}
