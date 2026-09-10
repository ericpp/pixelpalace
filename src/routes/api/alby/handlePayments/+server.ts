import { json, type Cookies } from '@sveltejs/kit';
import { getSessionFromCookie } from '$lib/server/alby/session';
import { getAwtCookie } from '$lib/server/alby/cookies';
import handlePayments from '$lib/server/alby/handlePayments';
import type { BoostPayment } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }: { cookies: Cookies; request: Request }) => {
	const session = getSessionFromCookie(getAwtCookie(cookies));

	if (!session?.access_token) {
		return json({ message: 'Not authenticated' }, { status: 401 });
	}

	try {
		const body = (await request.json()) as BoostPayment | BoostPayment[];
		const result = await handlePayments(session.access_token, body);
		return json(result);
	} catch (err) {
		console.log('handlePayment Error:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
};
