import { json, type Cookies } from '@sveltejs/kit';
import { getSessionFromCookie, refreshSession } from '$lib/server/alby/session';
import { getAwtCookie, setAwtCookie } from '$lib/server/alby/cookies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }: { cookies: Cookies }) => {
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
};
