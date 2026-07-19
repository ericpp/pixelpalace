import { exchangeCode, refreshAccessToken } from './token.js';
import { fetchAlbyUser } from './user.js';
import { signAlbyToken, verifyAlbyToken } from './jwt.js';

export async function authenticateWithCode(code, redirectUri, codeVerifier) {
	const tokenData = await exchangeCode(code, redirectUri, codeVerifier);
	const signedToken = signAlbyToken(tokenData);
	const user = await fetchAlbyUser(tokenData.access_token);
	return { signedToken, user };
}

export async function refreshSession(refreshToken) {
	const tokenData = await refreshAccessToken(refreshToken);
	const signedToken = signAlbyToken(tokenData);
	const user = await fetchAlbyUser(tokenData.access_token);
	return { signedToken, user };
}

export function getSessionFromCookie(awtCookie) {
	if (!awtCookie) return undefined;
	try {
		return verifyAlbyToken(awtCookie);
	} catch {
		return undefined;
	}
}
