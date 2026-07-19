import { getAlbyCredentials } from './credentials.js';

const TOKEN_URL = 'https://api.getalby.com/oauth/token';

async function requestToken(body) {
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

	return res.json();
}

export function exchangeCode(code, redirectUri, codeVerifier) {
	/** @type {Record<string, string>} */
	const body = {
		code,
		redirect_uri: redirectUri,
		grant_type: 'authorization_code'
	};
	if (codeVerifier) {
		body.code_verifier = codeVerifier;
	}
	return requestToken(body);
}

export function refreshAccessToken(refreshToken) {
	return requestToken({
		refresh_token: refreshToken,
		grant_type: 'refresh_token'
	});
}
