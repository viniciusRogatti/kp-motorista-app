import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export type QueueStatus = 'pending' | 'processing' | 'confirmed' | 'retry' | 'failed' | 'conflict';

export async function getQueueSummary(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ status: QueueStatus; total: number }>(
    'SELECT status, COUNT(*) AS total FROM offline_actions GROUP BY status',
  );
  const positions = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM location_positions WHERE sync_status != 'confirmed'",
  );
  const media = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM pending_media WHERE status != 'confirmed'",
  );

  return {
    actions: Object.fromEntries(rows.map((row) => [row.status, row.total])) as Partial<Record<QueueStatus, number>>,
    pendingPositions: positions?.total ?? 0,
    pendingMedia: media?.total ?? 0,
  };
}

export async function enqueueAction(
  db: SQLiteDatabase,
  input: { actionType: string; entityType: string; entityId?: string; payload: unknown },
) {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO offline_actions
      (id, action_type, entity_type, entity_id, payload, idempotency_key, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    id,
    input.actionType,
    input.entityType,
    input.entityId ?? null,
    JSON.stringify(input.payload),
    id,
    now,
    now,
  );
  return id;
}

export async function retryEligibleActions(db: SQLiteDatabase) {
  const now = new Date().toISOString();
  return db.runAsync(
    "UPDATE offline_actions SET status = 'pending', updated_at = ? WHERE status IN ('retry', 'failed')",
    now,
  );
}
