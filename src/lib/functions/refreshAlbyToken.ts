import { get } from 'svelte/store';
import { getAlbyServer, user } from '$/stores';
import type { AlbyUser, UserState } from '$lib/types';

const REFRESH_THRESHOLD = 600000;

let lastRefreshTime = 0;

export function applyAlbyUser(data: unknown): boolean {
	if (!data || typeof data !== 'object') return false;
	const userData = data as AlbyUser;
	if (userData.lightning_address) {
		user.update((current: UserState) => ({
			...current,
			loggedIn: true,
			name: userData.lightning_address,
			balance: typeof userData.balance === 'number' ? userData.balance : current.balance
		}));
		return true;
	}
	return false;
}

/** Refresh Alby token and balance if stale. Returns true when session is valid. */
export default async function refreshAlbyToken(): Promise<boolean> {
	const now = Date.now();
	if (now - lastRefreshTime < REFRESH_THRESHOLD) {
		return get<UserState>(user).loggedIn;
	}

	try {
		const res = await fetch(getAlbyServer() + '/api/alby/refresh', {
			credentials: 'include'
		});
		const data = (await res.json()) as AlbyUser;
		if (applyAlbyUser(data)) {
			lastRefreshTime = now;
			return true;
		}
		return false;
	} catch (err) {
		console.error('Error refreshing Alby token:', err);
		return false;
	}
}
