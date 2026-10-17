import { EFFECT_IDS, EFFECT_LABELS, isEffectId, type EffectId } from '$lib/effects';
import type { EffectSlotState, FiredEffect } from '$lib/types';
import { getUnlockConfig } from './config';
import { ensureSchema, type EffectCooldownRow, type Sql } from './db';
import { broadcastEffectSlots, broadcastFiredEffect } from './hub';
import { publishEffect } from './nostr';
import { notifyEffect } from './webhook';

export class EffectLockedError extends Error {
	effects: EffectSlotState[];

	constructor(effects: EffectSlotState[]) {
		super('Effects are cooling down');
		this.name = 'EffectLockedError';
		this.effects = effects;
	}
}

function unlockIntervalMs(): number {
	return getUnlockConfig().unlockSeconds * 1000;
}

function slotsForRemaining(remainingMs: number): EffectSlotState[] {
	const unlocked = remainingMs <= 0;
	return EFFECT_IDS.map((id) => ({
		id,
		unlocked,
		remainingMs: unlocked ? 0 : remainingMs
	}));
}

async function readGlobalSlots(db: Sql, intervalMs: number): Promise<EffectSlotState[]> {
	if (intervalMs <= 0) return slotsForRemaining(0);
	const rows = await db<EffectCooldownRow[]>`
		SELECT last_fired_at, now() AS db_now
		FROM effect_cooldown
		WHERE id = 1
	`;
	const row = rows[0];
	if (!row?.last_fired_at) return slotsForRemaining(0);
	const elapsed = new Date(row.db_now).getTime() - new Date(row.last_fired_at).getTime();
	return slotsForRemaining(Math.max(0, intervalMs - elapsed));
}

export async function getEffectSlots(_viewerId?: string): Promise<EffectSlotState[]> {
	const db = await ensureSchema();
	return readGlobalSlots(db, unlockIntervalMs());
}

async function claimCooldown(db: Sql): Promise<EffectSlotState[]> {
	const intervalMs = unlockIntervalMs();
	if (intervalMs <= 0) return slotsForRemaining(0);

	const seconds = getUnlockConfig().unlockSeconds;
	const claimed = await db`
		UPDATE effect_cooldown
		SET last_fired_at = now()
		WHERE id = 1
			AND (
				last_fired_at IS NULL
				OR last_fired_at <= now() - make_interval(secs => ${seconds})
			)
		RETURNING last_fired_at
	`;
	if (!claimed.length) {
		throw new EffectLockedError(await readGlobalSlots(db, intervalMs));
	}
	return readGlobalSlots(db, intervalMs);
}

export async function applyHeartbeat(
	viewerId: string,
	playing: boolean
): Promise<{ effects: EffectSlotState[] }> {
	if (playing) {
		const db = await ensureSchema();
		await db`
			UPDATE viewers
			SET last_heartbeat_at = ${new Date()}
			WHERE id = ${viewerId}
		`;
	}
	return { effects: await getEffectSlots(viewerId) };
}

export async function publishEffectBoost(input: {
	viewerId: string;
	effectId: EffectId;
	message: string;
	senderName: string;
	eventGuid?: string;
	blockGuid?: string;
}): Promise<{ effects: EffectSlotState[]; effect: FiredEffect }> {
	const db = await ensureSchema();
	const message = input.message.trim().slice(0, 500);
	const senderName = input.senderName.trim().slice(0, 64);
	const effect: FiredEffect = {
		id: input.effectId,
		label: EFFECT_LABELS[input.effectId],
		senderName,
		message
	};

	const effects = await db.begin(async (tx) => claimCooldown(tx as unknown as Sql));
	broadcastEffectSlots(effects);

	const noticeId = crypto.randomUUID();
	await Promise.all([
		notifyEffect({
			message,
			senderName,
			eventGuid: input.eventGuid,
			blockGuid: input.blockGuid
		}),
		publishEffect({
			id: noticeId,
			message,
			senderName,
			eventGuid: input.eventGuid,
			blockGuid: input.blockGuid
		}).catch((err) => {
			console.error('effect notice publish failed', err);
		})
	]);

	try {
		broadcastFiredEffect(effect);
	} catch (err) {
		console.error('effect broadcast failed', err);
	}

	return { effects, effect };
}

export async function consumeEffectUnlock(_viewerId: string, effectId: string): Promise<EffectSlotState[]> {
	if (!isEffectId(effectId)) {
		throw new Error('Unknown item');
	}
	const db = await ensureSchema();
	const effects = await db.begin(async (tx) => claimCooldown(tx as unknown as Sql));
	broadcastEffectSlots(effects);
	return effects;
}
