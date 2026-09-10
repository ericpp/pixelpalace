import { exchangeCode, refreshAccessToken } from './token';
import { fetchAlbyUser } from './user';
import { signAlbyToken, verifyAlbyToken } from './jwt';
import type { AlbyTokenData, AlbyUser } from '$lib/types';

export async function authenticateWithCode(
	code: string,
	redirectUri: string,
	codeVerifier?: string
): Promise<{ signedToken: string; user: AlbyUser }> {
	const tokenData = await exchangeCode(code, redirectUri, codeVerifier);
	const signedToken = signAlbyToken(tokenData);
	const user = await fetchAlbyUser(tokenData.access_token);
	return { signedToken, user };
}

export async function refreshSession(
	refreshToken: string
): Promise<{ signedToken: string; user: AlbyUser }> {
	const tokenData = await refreshAccessToken(refreshToken);
	const signedToken = signAlbyToken(tokenData);
	const user = await fetchAlbyUser(tokenData.access_token);
	return { signedToken, user };
}

export function getSessionFromCookie(awtCookie: string | undefined): AlbyTokenData | undefined {
	if (!awtCookie) return undefined;
	try {
		return verifyAlbyToken(awtCookie);
	} catch {
		return undefined;
	}
}
