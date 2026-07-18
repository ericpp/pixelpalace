import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

function getTargetBase() {
	const host = env.PUBLIC_EVENT_HOST?.replace(/\/$/, '');
	if (!host) {
		error(500, 'PUBLIC_EVENT_HOST is not configured');
	}
	return host;
}

async function proxy({ params, request, url }) {
	const target = new URL(`${getTargetBase()}/api/sk/${params.path}`);
	url.searchParams.forEach((value, key) => {
		target.searchParams.set(key, value);
	});

	const headers = new Headers();
	const contentType = request.headers.get('content-type');
	if (contentType) headers.set('content-type', contentType);
	const accept = request.headers.get('accept');
	if (accept) headers.set('accept', accept);

	/** @type {RequestInit} */
	const init = {
		method: request.method,
		headers
	};

	if (request.method !== 'GET' && request.method !== 'HEAD') {
		init.body = await request.arrayBuffer();
	}

	const upstream = await fetch(target, init);
	const responseHeaders = new Headers(upstream.headers);
	responseHeaders.delete('content-encoding');
	responseHeaders.delete('transfer-encoding');
	responseHeaders.delete('connection');

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders
	});
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
