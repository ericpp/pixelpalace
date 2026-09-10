import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

function trim(value: string | undefined): string | undefined {
	return value?.trim();
}

export function getAlbyCredentials(): { clientId: string; clientSecret: string } {
	const clientId =
		trim(env.ALBY_CLIENT_ID) ||
		trim(env.ALBY_USERNAME) ||
		trim(publicEnv.PUBLIC_ALBY_CLIENT_ID);
	const clientSecret = trim(env.ALBY_CLIENT_SECRET) || trim(env.ALBY_PASSWORD);
	if (!clientId || !clientSecret) {
		error(500, 'Alby OAuth credentials are not configured');
	}
	return { clientId, clientSecret };
}

export function getAlbyJwtSecret(): string {
	const secret = trim(env.ALBY_JWT);
	if (!secret) {
		error(500, 'ALBY_JWT is not configured');
	}
	return secret.split(/\s+/)[0];
}
