import { json } from '@sveltejs/kit';
import { clearAwtCookie } from '$lib/server/alby/cookies.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ cookies }) {
	clearAwtCookie(cookies);
	return json({ loggedIn: false });
}
