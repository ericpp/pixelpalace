import { EFFECT_IDS, EFFECT_LABELS, isEffectId, type EffectId } from '$lib/effects';
import type { EffectSlotState, FiredEffect } from '$lib/types';
import { getUnlockConfig } from './config';
import { ensureSchema, type EffectUnlockRow, type Sql, type ViewerRow } from './db';
import { broadcastFiredEffect } from './hub';
import { publishEffect } from './nostr';
import { notifyEffect } from './webhook';

export class EffectLockedError extends Error {
	effects: EffectSlotState[];

	constructor(effects: EffectSlotState[]) {
		super('Keep watching to unlock this item');
		this.name = 'EffectLockedError';
		this.effects = effects;
	}
}

function unlockIntervalMs(): number {
	return getUnlockConfig().unlockSeconds * 1000;
}

function slotsFromRows(rows: EffectUnlockRow[], intervalMs: number): EffectSlotState[] {
	const byId = new Map(rows.map((row) => [row.effect_id, row]));
	return EFFECT_IDS.map((id) => {
		const row = byId.get(id);
		if (row?.unlocked) return { id, unlocked: true, remainingMs: 0 };
		const pending = Number(row?.pending_ms) || 0;
		return { id, unlocked: false, remainingMs: Math.max(0, intervalMs - pending) };
	});
}

async function readEffectSlots(db: Sql, viewerId: string, intervalMs: number): Promise<EffectSlotState[]> {
	const rows = await db<EffectUnlockRow[]>`
		SELECT effect_id, pending_ms, unlocked
		FROM effect_unlocks
		WHERE viewer_id = ${viewerId}
	`;
	return slotsFromRows(rows, intervalMs);
}

export async function getEffectSlots(viewerId: string | undefined): Promise<EffectSlotState[]> {
	const intervalMs = unlockIntervalMs();
	if (!viewerId) return slotsFromRows([], intervalMs);
	const db = await ensureSchema();
	return readEffectSlots(db, viewerId, intervalMs);
}

async function lockAllEffects(db: Sql, viewerId: string): Promise<void> {
	for (const id of EFFECT_IDS) {
		await db`
			INSERT INTO effect_unlocks (viewer_id, effect_id, pending_ms, unlocked)
			VALUES (${viewerId}, ${id}, 0, false)
			ON CONFLICT (viewer_id, effect_id) DO UPDATE
			SET unlocked = false, pending_ms = 0
		`;
	}
}

async function creditLockedEffects(db: Sql, viewerId: string, creditedMs: number, intervalMs: number): Promise<void> {
	const rows = await db<EffectUnlockRow[]>`
		SELECT effect_id, pending_ms, unlocked
		FROM effect_unlocks
		WHERE viewer_id = ${viewerId}
		FOR UPDATE
	`;
	const byId = new Map(rows.map((row) => [row.effect_id, row]));
	for (const id of EFFECT_IDS) {
		const row = byId.get(id);
		let pending = Number(row?.pending_ms) || 0;
		let unlocked = Boolean(row?.unlocked);
		if (!unlocked) {
			pending += creditedMs;
			if (pending >= intervalMs) {
				unlocked = true;
				pending = 0;
			}
		}
		if (row) {
			await db`
				UPDATE effect_unlocks
				SET pending_ms = ${pending}, unlocked = ${unlocked}
				WHERE viewer_id = ${viewerId} AND effect_id = ${id}
			`;
		} else {
			await db`
				INSERT INTO effect_unlocks (viewer_id, effect_id, pending_ms, unlocked)
				VALUES (${viewerId}, ${id}, ${pending}, ${unlocked})
			`;
		}
	}
}

function asViewer(row: Record<string, unknown>): ViewerRow {
	return row as ViewerRow;
}

export async function applyHeartbeat(
	viewerId: string,
	playing: boolean
): Promise<{ effects: EffectSlotState[] }> {
	const intervalMs = unlockIntervalMs();
	if (!playing) {
		return { effects: await getEffectSlots(viewerId) };
	}

	const config = getUnlockConfig();
	const db = await ensureSchema();
	const now = new Date();

	return db.begin(async (tx) => {
		const rows = await tx`SELECT * FROM viewers WHERE id = ${viewerId} FOR UPDATE`;
		const viewer = rows[0] ? asViewer(rows[0]) : undefined;
		if (!viewer) {
			return { effects: slotsFromRows([], intervalMs) };
		}

		const lastHeartbeat = viewer.last_heartbeat_at
			? new Date(viewer.last_heartbeat_at).getTime()
			: null;
		let creditedMs = 0;

		if (lastHeartbeat != null) {
			const elapsed = now.getTime() - lastHeartbeat;
			if (elapsed > 0 && elapsed <= config.heartbeatHugeMs) {
				creditedMs = Math.min(elapsed, config.heartbeatMaxMs);
			}
		}

		await tx`
			UPDATE viewers
			SET last_heartbeat_at = ${now}
			WHERE id = ${viewerId}
		`;

		if (creditedMs > 0) {
			await creditLockedEffects(tx as unknown as Sql, viewerId, creditedMs, intervalMs);
		}

		return {
			effects: await readEffectSlots(tx as unknown as Sql, viewerId, intervalMs)
		};
	});
}

export async function publishEffectBoost(input: {
	viewerId: string;
	effectId: EffectId;
	message: string;
	senderName: string;
	eventGuid?: string;
	blockGuid?: string;
}): Promise<{ effects: EffectSlotState[]; effect: FiredEffect }> {
	const intervalMs = unlockIntervalMs();
	const db = await ensureSchema();
	const message = input.message.trim().slice(0, 500);
	const senderName = input.senderName.trim().slice(0, 64);
	const effect: FiredEffect = {
		id: input.effectId,
		label: EFFECT_LABELS[input.effectId],
		senderName,
		message
	};

	const effects = await db.begin(async (tx) => {
		const query = tx as unknown as Sql;
		await query`SELECT id FROM viewers WHERE id = ${input.viewerId} FOR UPDATE`;
		const current = await readEffectSlots(query, input.viewerId, intervalMs);
		const slot = current.find((item) => item.id === input.effectId);
		if (!slot?.unlocked) {
			throw new EffectLockedError(current);
		}

		await lockAllEffects(query, input.viewerId);
		return readEffectSlots(query, input.viewerId, intervalMs);
	});

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

export async function consumeEffectUnlock(viewerId: string, effectId: string): Promise<EffectSlotState[]> {
	if (!isEffectId(effectId)) {
		throw new Error('Unknown item');
	}
	const intervalMs = unlockIntervalMs();
	const db = await ensureSchema();
	return db.begin(async (tx) => {
		const query = tx as unknown as Sql;
		await query`SELECT id FROM viewers WHERE id = ${viewerId} FOR UPDATE`;
		const current = await readEffectSlots(query, viewerId, intervalMs);
		const slot = current.find((item) => item.id === effectId);
		if (!slot?.unlocked) {
			throw new EffectLockedError(current);
		}
		await lockAllEffects(query, viewerId);
		return readEffectSlots(query, viewerId, intervalMs);
	});
}
