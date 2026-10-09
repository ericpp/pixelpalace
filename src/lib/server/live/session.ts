import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { getViewerJwtSecret } from './config';
import { ensureSchema } from './db';

const COOKIE_NAME = 'viewer';
const MAX_AGE = 30 * 24 * 60 * 60;

interface ViewerSessionPayload {
	vid: string;
}

export function setViewerCookie(cookies: Cookies, token: string): void {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		maxAge: MAX_AGE,
		sameSite: 'lax',
		secure: !dev
	});
}

export function getViewerCookie(cookies: Cookies): string | undefined {
	return cookies.get(COOKIE_NAME);
}

export function signViewerToken(viewerId: string): string {
	return jwt.sign({ vid: viewerId }, getViewerJwtSecret(), { expiresIn: '30d' });
}

export function verifyViewerToken(token: string): string | undefined {
	try {
		const payload = jwt.verify(token, getViewerJwtSecret()) as ViewerSessionPayload;
		if (payload?.vid && typeof payload.vid === 'string') {
			return payload.vid;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function readCookie(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const trimmed = part.trim();
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		if (trimmed.slice(0, eq) === name) {
			return decodeURIComponent(trimmed.slice(eq + 1));
		}
	}
	return undefined;
}

export function getViewerIdFromCookieHeader(cookieHeader: string | undefined): string | undefined {
	const token = readCookie(cookieHeader, COOKIE_NAME);
	if (!token) return undefined;
	return verifyViewerToken(token);
}

function readViewerId(cookies: Cookies): string | undefined {
	const token = getViewerCookie(cookies);
	if (!token) return undefined;
	return verifyViewerToken(token);
}

export async function getOrCreateViewerId(cookies: Cookies): Promise<string> {
	const db = await ensureSchema();
	const existing = readViewerId(cookies);
	if (existing) {
		const rows = await db`SELECT id FROM viewers WHERE id = ${existing}`;
		if (rows.length) {
			setViewerCookie(cookies, signViewerToken(existing));
			return existing;
		}
	}

	const id = crypto.randomUUID();
	await db`INSERT INTO viewers (id) VALUES (${id})`;
	setViewerCookie(cookies, signViewerToken(id));
	return id;
}
