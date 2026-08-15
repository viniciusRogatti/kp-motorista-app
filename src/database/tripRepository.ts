import type { SQLiteDatabase } from 'expo-sqlite';

import { assignedTripSchema, type AssignedTrip } from '@/types/trip';

export async function readCachedAssignedTrip(db: SQLiteDatabase): Promise<AssignedTrip | null> {
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM active_trip ORDER BY updated_at DESC LIMIT 1',
  );
  if (!row) return null;

  try {
    const parsed = assignedTripSchema.safeParse(JSON.parse(row.payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function replaceCachedAssignedTrip(db: SQLiteDatabase, trip: AssignedTrip | null) {
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM active_trip');
    await transaction.runAsync('DELETE FROM trip_stops');
    if (!trip) return;

    await transaction.runAsync(
      'INSERT INTO active_trip (id, payload, status, updated_at) VALUES (?, ?, ?, ?)',
      String(trip.id),
      JSON.stringify(trip),
      trip.status,
      now,
    );
    for (const stop of trip.stops) {
      await transaction.runAsync(
        `INSERT INTO trip_stops (id, trip_id, sequence, status, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        String(stop.id),
        String(trip.id),
        stop.sequence,
        stop.status,
        JSON.stringify(stop),
        now,
      );
    }
  });
}
