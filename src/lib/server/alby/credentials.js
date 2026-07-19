import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

export function getAlbyCredentials() {
	const clientId = env.ALBY_CLIENT_ID?.trim();
	const clientSecret = env.ALBY_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) {
		error(500, 'Alby OAuth credentials are not configured');
	}
	return { clientId, clientSecret };
}

export function getAlbyJwtSecret() {
	const secret = env.ALBY_JWT?.trim();
	if (!secret) {
		error(500, 'ALBY_JWT is not configured');
	}
	return secret;
}
