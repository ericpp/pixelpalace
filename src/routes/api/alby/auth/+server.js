import { json } from '@sveltejs/kit';
import { authenticateWithCode } from '$lib/server/alby/session.js';
import { setAwtCookie } from '$lib/server/alby/cookies.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	const code = url.searchParams.get('code');
	const redirectUri = url.searchParams.get('redirect_uri');

	if (!code) {
		return json([]);
	}

	try {
		const { signedToken, user } = await authenticateWithCode(code, redirectUri || '');
		setAwtCookie(cookies, signedToken);
		return json(user);
	} catch (err) {
		console.log('alby auth:', err);
		return json({ message: 'Server Error' }, { status: 500 });
	}
}
