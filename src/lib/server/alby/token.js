import { getAlbyCredentials } from './credentials.js';

const TOKEN_URL = 'https://api.getalby.com/oauth/token';

function basicAuthHeader() {
	const { clientId, clientSecret } = getAlbyCredentials();
	return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function requestToken(body) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(body)) {
		formData.append(key, value);
	}

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			Authorization: basicAuthHeader()
		},
		body: formData
	});

	if (!res.ok) {
		const text = await res.text();
		console.log('Alby oauth/token error:', text, 'redirect_uri:', body.redirect_uri || '(refresh)');
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
