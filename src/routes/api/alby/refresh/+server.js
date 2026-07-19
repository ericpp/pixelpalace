import { json } from '@sveltejs/kit';
import { getSessionFromCookie, refreshSession } from '$lib/server/alby/session.js';
import { getAwtCookie, setAwtCookie } from '$lib/server/alby/cookies.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	const session = getSessionFromCookie(getAwtCookie(cookies));

	if (!session?.refresh_token) {
		return json([]);
	}

	try {
		const { signedToken, user } = await refreshSession(session.refresh_token);
		setAwtCookie(cookies, signedToken);
		return json(user);
	} catch (err) {
		console.log('alby refresh:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
}
