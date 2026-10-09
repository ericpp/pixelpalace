import { getAppName, getEffectWebhook } from './config';

export type EffectNoticePayload = {
	action: 'effect';
	app_name: string;
	message: string;
	sender_name: string;
	eventGuid?: string;
	blockGuid?: string;
};

export async function notifyEffect(input: {
	message: string;
	senderName: string;
	eventGuid?: string;
	blockGuid?: string;
}): Promise<void> {
	const url = getEffectWebhook();
	if (!url) return;

	const payload: EffectNoticePayload = {
		action: 'effect',
		app_name: getAppName(),
		message: input.message,
		sender_name: input.senderName,
		eventGuid: input.eventGuid,
		blockGuid: input.blockGuid
	};

	try {
		await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch (err) {
		console.error('effect webhook failed', err);
	}
}
