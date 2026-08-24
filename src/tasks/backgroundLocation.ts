import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { openDatabaseAsync } from 'expo-sqlite';

import { readStoredSession } from '@/auth/sessionStorage';
import {
  markLocationConfirmed,
  markLocationForRetry,
  readPendingLocations,
  saveLocation,
} from '@/database/locationRepository';
import { DATABASE_NAME, migrateDatabase } from '@/database/schema';
import { getDriverTrackingConfig, registerDriverLocation } from '@/services/trips';
import {
  clearActiveTripTracking,
  readActiveTripTracking,
  writeActiveTripTracking,
} from '@/tasks/tripTrackingState';

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
      const activeTracking = await readActiveTripTracking();
      for (const location of locations) {
        await saveLocation(db, location, activeTracking ? String(activeTracking.tripId) : undefined);
      }

      if (activeTracking) {
        const session = await readStoredSession();
        if (session) {
          const pendingLocations = await readPendingLocations(db);
          for (const pending of pendingLocations) {
            try {
              await registerDriverLocation(session.token, {
                id: pending.id,
                tripId: Number(pending.trip_id),
                latitude: pending.latitude,
                longitude: pending.longitude,
                accuracy: pending.accuracy,
                speed: pending.speed,
                heading: pending.heading,
                recordedAt: pending.recorded_at,
              });
              await markLocationConfirmed(db, pending.id);
            } catch {
              await markLocationForRetry(db, pending.id);
              break;
            }
          }
        }
      }
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
  const activeTracking = await readActiveTripTracking();
  if (activeTracking?.stopAt && new Date(activeTracking.stopAt).getTime() <= Date.now()) {
    if (await isBackgroundTrackingActive()) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await clearActiveTripTracking();
    return;
  }
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
      notificationTitle: 'ASTRO — rastreamento de teste',
      notificationBody: 'Diagnostico ativo. Pare o teste ao finalizar.',
      killServiceOnDestroy: false,
    },
  });
}

export async function startTripTracking(tripId: number, token: string, stopAt: string | null = null) {
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (foregroundPermission.status !== 'granted') {
    throw new Error('Permita o acesso a localizacao para compartilhar sua posicao com a expedicao.');
  }

  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (backgroundPermission.status !== 'granted') {
    throw new Error('Permita a localizacao o tempo todo para manter o rastreamento com a tela bloqueada.');
  }

  const config = await getDriverTrackingConfig(token).catch(() => ({ location_update_interval_ms: 60_000 }));
  const updateInterval = Math.max(60_000, config.location_update_interval_ms);
  const currentTracking = await readActiveTripTracking();
  if (await isBackgroundTrackingActive()) {
    if (currentTracking?.tripId === tripId) {
      await writeActiveTripTracking(tripId, stopAt);
      return;
    }
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  await writeActiveTripTracking(tripId, stopAt);
  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: updateInterval,
      distanceInterval: 25,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'ASTRO — localizacao ativa',
        notificationBody: 'Sua posicao esta sendo compartilhada durante a viagem.',
        killServiceOnDestroy: false,
      },
    });
  } catch (error) {
    await clearActiveTripTracking();
    throw error;
  }

  try {
    const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
    await persistLocations([currentLocation]);
  } catch {
    // O servico ja esta ativo; a proxima leitura sera persistida e sincronizada pela tarefa.
  }
}

export async function stopTripTracking() {
  if (await isBackgroundTrackingActive()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await clearActiveTripTracking();
}

export async function stopDiagnosticTracking() {
  if (await isBackgroundTrackingActive()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  await clearActiveTripTracking();
}
