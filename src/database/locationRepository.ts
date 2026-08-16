import * as Crypto from 'expo-crypto';
import type { LocationObject } from 'expo-location';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function saveLocation(db: SQLiteDatabase, location: LocationObject, tripId?: string) {
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO location_positions
      (id, trip_id, latitude, longitude, accuracy, speed, heading, recorded_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    id,
    tripId ?? null,
    location.coords.latitude,
    location.coords.longitude,
    location.coords.accuracy,
    location.coords.speed,
    location.coords.heading,
    new Date(location.timestamp).toISOString(),
  );
  return id;
}

export type PendingLocation = {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

export async function readPendingLocations(db: SQLiteDatabase, limit = 50) {
  return db.getAllAsync<PendingLocation>(
    `SELECT id, trip_id, latitude, longitude, accuracy, speed, heading, recorded_at
       FROM location_positions
      WHERE sync_status IN ('pending', 'retry') AND trip_id IS NOT NULL
      ORDER BY recorded_at ASC
      LIMIT ?`,
    limit,
  );
}

export async function markLocationConfirmed(db: SQLiteDatabase, id: string) {
  await db.runAsync(
    "UPDATE location_positions SET sync_status = 'confirmed' WHERE id = ?",
    id,
  );
}

export async function markLocationForRetry(db: SQLiteDatabase, id: string) {
  await db.runAsync(
    "UPDATE location_positions SET sync_status = 'retry' WHERE id = ?",
    id,
  );
}
