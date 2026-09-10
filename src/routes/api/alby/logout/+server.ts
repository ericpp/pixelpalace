import { json, type Cookies } from '@sveltejs/kit';
import { clearAwtCookie } from '$lib/server/alby/cookies';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }: { cookies: Cookies }) => {
	clearAwtCookie(cookies);
	return json({ loggedIn: false });
};
