import { json } from '@sveltejs/kit';
import { getDatabaseUrl, isLiveEnabled } from './config';

export function liveUnavailableResponse() {
	if (!isLiveEnabled()) {
		return json({ message: 'Effects are disabled' }, { status: 404 });
	}
	if (!getDatabaseUrl()) {
		return json({ message: 'Effects are not configured' }, { status: 503 });
	}
	return null;
}
