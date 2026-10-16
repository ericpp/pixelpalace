import { getBoardScope } from '$lib/server/live/config';

export function load() {
	return {
		boardScope: getBoardScope()
	};
}
