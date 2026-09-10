import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_NAME = 'awt';
const MAX_AGE = 30 * 24 * 60 * 60;

export function setAwtCookie(cookies: Cookies, token: string): void {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		maxAge: MAX_AGE,
		sameSite: 'lax',
		secure: !dev
	});
}

export function clearAwtCookie(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function getAwtCookie(cookies: Cookies): string | undefined {
	return cookies.get(COOKIE_NAME);
}
