import * as SecureStore from 'expo-secure-store';

const ACTIVE_TRIP_TRACKING_KEY = 'kp.motorista.active-trip-tracking.v1';

export type ActiveTripTracking = {
  tripId: number;
  startedAt: string;
  stopAt: string | null;
};

export async function readActiveTripTracking(): Promise<ActiveTripTracking | null> {
  const value = await SecureStore.getItemAsync(ACTIVE_TRIP_TRACKING_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ActiveTripTracking>;
    const tripId = Number(parsed.tripId);
    if (Number.isInteger(tripId) && tripId > 0 && typeof parsed.startedAt === 'string') {
      return { tripId, startedAt: parsed.startedAt, stopAt: typeof parsed.stopAt === 'string' ? parsed.stopAt : null };
    }
  } catch {
    // A configuracao corrompida e removida abaixo.
  }

  await clearActiveTripTracking();
  return null;
}

export async function writeActiveTripTracking(tripId: number, stopAt: string | null = null) {
  await SecureStore.setItemAsync(ACTIVE_TRIP_TRACKING_KEY, JSON.stringify({
    tripId,
    startedAt: new Date().toISOString(),
    stopAt,
  } satisfies ActiveTripTracking));
}

export async function clearActiveTripTracking() {
  await SecureStore.deleteItemAsync(ACTIVE_TRIP_TRACKING_KEY);
}
