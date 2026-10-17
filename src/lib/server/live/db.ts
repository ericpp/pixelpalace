import postgres from 'postgres';
import { getDatabaseUrl } from './config';

export type Sql = postgres.Sql;

let sql: Sql | null = null;
let schemaPromise: Promise<void> | null = null;

export function getSql(): Sql {
	if (!sql) {
		const url = getDatabaseUrl();
		if (!url) {
			throw new Error('DATABASE_URL is required');
		}
		sql = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10 });
	}
	return sql;
}

async function dropLegacyTables(db: Sql): Promise<void> {
	const rows = await db`
		SELECT 1
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE c.relname = 'token_viewers' AND n.nspname = 'public'
	`;
	if (!rows.length) return;

	await db`DROP TABLE IF EXISTS effect_unlocks CASCADE`;
	await db`DROP TABLE IF EXISTS boosts CASCADE`;
	await db`DROP TABLE IF EXISTS token_boosts CASCADE`;
	await db`DROP TABLE IF EXISTS token_viewers CASCADE`;
}

async function createSchema(db: Sql): Promise<void> {
	await dropLegacyTables(db);
	await db`DROP TABLE IF EXISTS boosts CASCADE`;
	await db`DROP TABLE IF EXISTS effect_unlocks CASCADE`;
	await db`
		CREATE TABLE IF NOT EXISTS viewers (
			id TEXT PRIMARY KEY,
			last_heartbeat_at TIMESTAMPTZ
		)
	`;
	await db`
		CREATE TABLE IF NOT EXISTS effect_cooldown (
			id INT PRIMARY KEY CHECK (id = 1),
			last_fired_at TIMESTAMPTZ
		)
	`;
	await db`
		INSERT INTO effect_cooldown (id, last_fired_at)
		VALUES (1, NULL)
		ON CONFLICT (id) DO NOTHING
	`;
}

export async function ensureSchema(): Promise<Sql> {
	const db = getSql();
	if (!schemaPromise) {
		schemaPromise = createSchema(db).catch((err) => {
			schemaPromise = null;
			throw err;
		});
	}
	await schemaPromise;
	return db;
}

export type ViewerRow = {
	id: string;
	last_heartbeat_at: Date | null;
};

export type EffectCooldownRow = {
	last_fired_at: Date | null;
	db_now: Date;
};
