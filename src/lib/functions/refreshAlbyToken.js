import { get } from 'svelte/store';
import { getAlbyServer, user } from '$/stores';

const REFRESH_THRESHOLD = 600000;

let lastRefreshTime = 0;

function applyAlbyUser(data) {
	if (data?.lightning_address) {
		user.update((current) => ({
			...current,
			loggedIn: true,
			name: data.lightning_address,
			balance: data.balance
		}));
		return true;
	}
	return false;
}

/** Refresh Alby token and balance if stale. Returns true when session is valid. */
export default async function refreshAlbyToken() {
	const now = Date.now();
	if (now - lastRefreshTime < REFRESH_THRESHOLD) {
		return get(user).loggedIn;
	}

	try {
		const res = await fetch(getAlbyServer() + '/api/alby/refresh', {
			credentials: 'include'
		});
		const data = await res.json();
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

export { applyAlbyUser };
