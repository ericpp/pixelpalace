import { json, type Cookies } from '@sveltejs/kit';
import { authenticateWithCode } from '$lib/server/alby/session';
import { setAwtCookie } from '$lib/server/alby/cookies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }: { url: URL; cookies: Cookies }) => {
	const code = url.searchParams.get('code');
	const redirectUri = url.searchParams.get('redirect_uri');
	const codeVerifier = url.searchParams.get('code_verifier') || undefined;

	if (!code) {
		return json([]);
	}

	try {
		const { signedToken, user } = await authenticateWithCode(code, redirectUri || '', codeVerifier);
		setAwtCookie(cookies, signedToken);
		return json(user);
	} catch (err) {
		console.log('alby auth:', err, 'redirect_uri:', redirectUri);
		return json({ message: 'Server Error' }, { status: 500 });
	}
};
