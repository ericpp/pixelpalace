import { dev } from '$app/environment';

const COOKIE_NAME = 'awt';
const MAX_AGE = 30 * 24 * 60 * 60;

export function setAwtCookie(cookies, token) {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		maxAge: MAX_AGE,
		sameSite: 'lax',
		secure: !dev
	});
}

export function clearAwtCookie(cookies) {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function getAwtCookie(cookies) {
	return cookies.get(COOKIE_NAME);
}
