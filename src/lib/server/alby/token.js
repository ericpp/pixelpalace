import { getAlbyCredentials } from './credentials.js';

const TOKEN_URL = 'https://api.getalby.com/oauth/token';

function basicAuthHeader() {
	const { clientId, clientSecret } = getAlbyCredentials();
	return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function requestToken(body) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			Authorization: basicAuthHeader(),
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams(body)
	});

	if (!res.ok) {
		const text = await res.text();
		console.log('Alby oauth/token error:', text);
		throw new Error(`Alby token request failed: ${res.status}`);
	}

	return res.json();
}

export function exchangeCode(code, redirectUri) {
	return requestToken({
		code,
		redirect_uri: redirectUri,
		grant_type: 'authorization_code'
	});
}

export function refreshAccessToken(refreshToken) {
	return requestToken({
		refresh_token: refreshToken,
		grant_type: 'refresh_token'
	});
}
