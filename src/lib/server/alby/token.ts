import { getAlbyCredentials } from './credentials';
import type { AlbyTokenData } from '$lib/types';

const TOKEN_URL = 'https://api.getalby.com/oauth/token';

async function requestToken(body: Record<string, string>): Promise<AlbyTokenData> {
	const { clientId, clientSecret } = getAlbyCredentials();
	const params = new URLSearchParams({
		...body,
		client_id: clientId,
		client_secret: clientSecret
	});

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: params
	});

	if (!res.ok) {
		const text = await res.text();
		console.log(
			'Alby oauth/token error:',
			text,
			'redirect_uri:',
			body.redirect_uri || '(refresh)',
			'client_id:',
			clientId
		);
		throw new Error(`Alby token request failed: ${res.status}`);
	}

	return res.json() as Promise<AlbyTokenData>;
}

export function exchangeCode(
	code: string,
	redirectUri: string,
	codeVerifier?: string
): Promise<AlbyTokenData> {
	const body: Record<string, string> = {
		code,
		redirect_uri: redirectUri,
		grant_type: 'authorization_code'
	};
	if (codeVerifier) {
		body.code_verifier = codeVerifier;
	}
	return requestToken(body);
}

export function refreshAccessToken(refreshToken: string): Promise<AlbyTokenData> {
	return requestToken({
		refresh_token: refreshToken,
		grant_type: 'refresh_token'
	});
}
