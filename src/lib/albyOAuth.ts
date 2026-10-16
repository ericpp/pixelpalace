import { getAlbyOAuthUrl } from '$/stores';
import { generateCodeChallenge, generateCodeVerifier } from '$lib/pkce';

const REDIRECT_URI_KEY = 'alby_redirect_uri';
const CODE_VERIFIER_KEY = 'alby_code_verifier';
const CODE_PREFIX = 'alby_code_used:';

/** Start the Alby OAuth login, storing the PKCE verifier and redirect URI first. */
export async function startAlbyLogin(redirectUri: string): Promise<void> {
	const verifier = generateCodeVerifier();
	const challenge = await generateCodeChallenge(verifier);
	storeAlbyRedirectUri(redirectUri);
	storeAlbyCodeVerifier(verifier);
	window.location.href = getAlbyOAuthUrl(redirectUri, { codeChallenge: challenge });
}

export function storeAlbyRedirectUri(redirectUri: string): void {
	sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri);
}

export function consumeAlbyRedirectUri(fallback: string): string {
	const stored = sessionStorage.getItem(REDIRECT_URI_KEY);
	if (stored) {
		sessionStorage.removeItem(REDIRECT_URI_KEY);
		return stored;
	}
	return fallback;
}

export function storeAlbyCodeVerifier(codeVerifier: string): void {
	sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
}

export function consumeAlbyCodeVerifier(): string | undefined {
	const stored = sessionStorage.getItem(CODE_VERIFIER_KEY);
	if (stored) {
		sessionStorage.removeItem(CODE_VERIFIER_KEY);
		return stored;
	}
	return undefined;
}

/** Returns false if this code was already claimed (prevents parallel double exchange). */
export function claimAlbyCode(code: string): boolean {
	const key = CODE_PREFIX + code;
	if (sessionStorage.getItem(key)) {
		return false;
	}
	sessionStorage.setItem(key, '1');
	return true;
}
