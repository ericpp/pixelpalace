function base64UrlEncode(bytes) {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier) {
	const data = new TextEncoder().encode(verifier);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return base64UrlEncode(new Uint8Array(digest));
}
