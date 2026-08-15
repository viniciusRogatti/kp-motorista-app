import * as Crypto from 'expo-crypto';
import type { LocationObject } from 'expo-location';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function saveLocation(db: SQLiteDatabase, location: LocationObject, tripId?: string) {
  await db.runAsync(
    `INSERT INTO location_positions
      (id, trip_id, latitude, longitude, accuracy, speed, heading, recorded_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    Crypto.randomUUID(),
    tripId ?? null,
    location.coords.latitude,
    location.coords.longitude,
    location.coords.accuracy,
    location.coords.speed,
    location.coords.heading,
    new Date(location.timestamp).toISOString(),
  );
}
