import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function isBlockedHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
		return true;
	}
	if (host === '::1' || host === '0.0.0.0') {
		return true;
	}
	if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) {
		return true;
	}
	if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
		return true;
	}
	if (/^169\.254\./.test(host) || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
		return true;
	}
	return false;
}

export const GET: RequestHandler = async ({ url }) => {
	const target = url.searchParams.get('url');
	if (!target) {
		return json({ message: 'url is required' }, { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return json({ message: 'invalid url' }, { status: 400 });
	}

	if (parsed.protocol !== 'https:') {
		return json({ message: 'https only' }, { status: 400 });
	}
	if (isBlockedHost(parsed.hostname)) {
		return json({ message: 'host not allowed' }, { status: 400 });
	}

	const res = await fetch(parsed.toString());
	const body = await res.text();
	return new Response(body, {
		status: res.status,
		headers: {
			'content-type': res.headers.get('content-type') || 'application/json'
		}
	});
};
