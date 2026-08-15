import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { openDatabaseAsync } from 'expo-sqlite';

import { saveLocation } from '@/database/locationRepository';
import { DATABASE_NAME, migrateDatabase } from '@/database/schema';

export const BACKGROUND_LOCATION_TASK = 'kp-driver-active-trip-location';

type LocationTaskData = { locations?: Location.LocationObject[] };

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isDatabaseBusy(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /database is locked|SQLITE_BUSY/i.test(message);
}

async function persistLocations(locations: Location.LocationObject[]) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const db = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
    try {
      await migrateDatabase(db);
      for (const location of locations) await saveLocation(db, location);
      return;
    } catch (error) {
      lastError = error;
      if (!isDatabaseBusy(error) || attempt === 2) throw error;
    } finally {
      await db.closeAsync().catch(() => undefined);
    }
    await wait(250 * (attempt + 1));
  }
  throw lastError;
}

TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await persistLocations(data.locations);
});

export async function isBackgroundTrackingActive() {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

export async function startDiagnosticTracking() {
  if (await isBackgroundTrackingActive()) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 60_000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'KP Motorista — rastreamento de teste',
      notificationBody: 'Diagnostico ativo. Pare o teste ao finalizar.',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopDiagnosticTracking() {
  if (await isBackgroundTrackingActive()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
