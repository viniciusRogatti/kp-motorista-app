import { z } from 'zod';

import { assignedTripSchema } from '@/types/trip';

import { ApiError, apiRequest } from './http';

const assignedTripResponseSchema = z.object({
  trip: assignedTripSchema.nullable(),
  serverTime: z.string().min(1),
});

const legacyTripSchema = z.object({
  id: z.coerce.number().int().positive(),
  driver_id: z.coerce.number().int().positive(),
  car_id: z.coerce.number().int().positive(),
  date: z.string().min(1),
  run_number: z.coerce.number().int().positive().default(1),
  gross_weight: z.union([z.string(), z.number()]).optional(),
  updated_at: z.string().nullable().optional(),
  Driver: z.object({ id: z.coerce.number().int().positive(), name: z.string().optional() }).nullable().optional(),
  Car: z.object({
    id: z.coerce.number().int().positive(),
    model: z.string().optional(),
    license_plate: z.string().optional(),
  }).nullable().optional(),
  TripNotes: z.array(z.object({
    id: z.coerce.number().int().positive(),
    company_id: z.coerce.number().int().positive().nullable().optional(),
    company_code: z.string().nullable().optional(),
    order: z.coerce.number().int().nonnegative(),
    invoice_number: z.union([z.string(), z.number()]).transform(String),
    customer_name: z.string().optional(),
    city: z.string().optional(),
    status: z.string().min(1),
    gross_weight: z.union([z.string(), z.number()]).optional(),
    box_quantity: z.coerce.number().nonnegative().nullable().optional(),
    customer_id: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
    phone: z.union([z.string(), z.number()]).transform(String).nullable().optional(),
    address: z.string().optional(),
    address_number: z.union([z.string(), z.number()]).transform(String).optional(),
    neighborhood: z.string().optional(),
    state: z.string().optional(),
    zip_code: z.union([z.string(), z.number()]).transform(String).optional(),
    representative_name: z.string().nullable().optional(),
    receipt_group_name: z.string().nullable().optional(),
    products: z.array(z.object({
      code: z.union([z.string(), z.number()]).transform(String).optional(),
      description: z.string().optional(),
      type: z.string().nullable().optional(),
      quantity: z.coerce.number().nonnegative().optional(),
    })).optional(),
    updated_at: z.string().nullable().optional(),
  })).default([]),
});

const legacyResponseSchema = z.object({ trips: z.array(legacyTripSchema).default([]) });
const stopStatusResponseSchema = z.object({
  accepted: z.literal(true),
  stop: z.object({ id: z.coerce.number().int().positive(), status: z.string().min(1) }).nullable(),
}).passthrough();
const reorderResponseSchema = z.object({
  accepted: z.literal(true),
  trip_id: z.coerce.number().int().positive(),
  items: z.array(z.object({
    stop_id: z.coerce.number().int().positive(),
    sequence: z.coerce.number().int().positive(),
  }).passthrough()),
}).passthrough();
const trackingConfigSchema = z.object({
  config: z.object({
    location_update_interval_ms: z.coerce.number().int().positive().default(300_000),
  }),
}).passthrough();
const locationResponseSchema = z.object({ accepted: z.literal(true) }).passthrough();
const finalStatuses = new Set(['returned', 'cancelled', 'delivered', 'completed', 'redelivery', 'retained']);

function safeNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function mapLegacyTrip(response: unknown, expectedTripId?: number) {
  const parsed = legacyResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new ApiError('O servidor retornou viagens em formato inválido.', null, 'INVALID_LEGACY_TRIP_RESPONSE');
  }

  const trip = expectedTripId
    ? parsed.data.trips.find((candidate) => candidate.id === expectedTripId)
    : parsed.data.trips.find((candidate) => candidate.TripNotes.some(
      (stop) => !finalStatuses.has(stop.status.toLowerCase()),
    ));
  if (!trip) return null;

  const stops = trip.TripNotes.map((stop) => ({
    id: stop.id,
    companyId: stop.company_id ?? null,
    companyCode: stop.company_code?.toLowerCase() ?? null,
    sequence: stop.order,
    invoiceNumber: stop.invoice_number,
    customerName: stop.customer_name ?? '',
    city: stop.city ?? '',
    status: stop.status.toLowerCase(),
    grossWeight: safeNumber(stop.gross_weight),
    boxQuantity: stop.box_quantity ?? null,
    customerId: stop.customer_id ?? null,
    phone: stop.phone ?? null,
    address: stop.address ?? '',
    addressNumber: stop.address_number ?? '',
    neighborhood: stop.neighborhood ?? '',
    state: stop.state ?? '',
    zipCode: stop.zip_code ?? '',
    representativeName: stop.representative_name ?? null,
    receiptGroupName: stop.receipt_group_name ?? null,
    products: (stop.products ?? []).map((product) => ({
      code: product.code ?? '',
      description: product.description ?? 'Produto sem descrição',
      type: product.type ?? null,
      quantity: product.quantity ?? 0,
    })),
    updatedAt: stop.updated_at ?? null,
  })).sort((left, right) => left.sequence - right.sequence || left.id - right.id);
  const completedStops = stops.filter((stop) => finalStatuses.has(stop.status)).length;
  const activeStop = stops.find((stop) => stop.status === 'arrived')
    || stops.find((stop) => stop.status === 'on_the_way');

  return assignedTripSchema.parse({
    id: trip.id,
    date: trip.date,
    runNumber: trip.run_number,
    grossWeight: safeNumber(trip.gross_weight),
    status: activeStop?.status ?? 'assigned',
    updatedAt: trip.updated_at ?? null,
    driver: { id: trip.driver_id, name: trip.Driver?.name ?? '' },
    vehicle: {
      id: trip.car_id,
      model: trip.Car?.model ?? '',
      licensePlate: trip.Car?.license_plate ?? '',
    },
    summary: {
      totalStops: stops.length,
      completedStops,
      pendingStops: Math.max(0, stops.length - completedStops),
    },
    tracking: { acceptedAt: null, active: false, operationalCompletedAt: null, stopAt: null },
    stops,
  });
}

function mergeTripDetails(base: ReturnType<typeof assignedTripSchema.parse>, details: ReturnType<typeof assignedTripSchema.parse>) {
  const detailsById = new Map(details.stops.map((stop) => [stop.id, stop]));
  return assignedTripSchema.parse({
    ...base,
    stops: base.stops.map((stop) => {
      const detail = detailsById.get(stop.id);
      if (!detail) return stop;
      return {
        ...stop,
        companyId: detail.companyId,
        companyCode: detail.companyCode,
        customerId: detail.customerId,
        phone: detail.phone,
        address: detail.address,
        addressNumber: detail.addressNumber,
        neighborhood: detail.neighborhood,
        state: detail.state,
        zipCode: detail.zipCode,
        representativeName: detail.representativeName,
        receiptGroupName: detail.receiptGroupName,
        products: detail.products,
      };
    }),
  });
}

export async function getAssignedTrip(token: string, driverId: number) {
  let response: unknown;
  try {
    response = await apiRequest<unknown>('/driver-app/trips/assigned', { token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const legacy = await apiRequest<unknown>(`/trips/search/driver/${driverId}`, { token });
    return { trip: mapLegacyTrip(legacy), serverTime: new Date().toISOString() };
  }
  const parsed = assignedTripResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new ApiError('O servidor retornou uma viagem em formato inválido.', null, 'INVALID_TRIP_RESPONSE');
  }
  const assigned = parsed.data;
  const needsDetails = assigned.trip?.stops.some((stop) => !stop.companyCode || (!stop.address && stop.products.length === 0));
  if (!assigned.trip || !needsDetails) return assigned;

  try {
    const legacy = await apiRequest<unknown>(`/trips/search/driver/${driverId}`, { token });
    const details = mapLegacyTrip(legacy, assigned.trip.id);
    return details ? { ...assigned, trip: mergeTripDetails(assigned.trip, details) } : assigned;
  } catch {
    return assigned;
  }
}

export async function updateTripStopStatus(token: string, stopId: number, status: 'on_the_way' | 'arrived' | 'delivered_pending_receipt', clientEventId: string) {
  const response = await apiRequest<unknown>(`/driver-app/trip-stops/${stopId}/status`, {
    method: 'POST',
    token,
    body: JSON.stringify({ status, clientEventId, source: 'mobile_status_change', recordedAt: new Date().toISOString() }),
  });
  const parsed = stopStatusResponseSchema.safeParse(response);
  if (!parsed.success) throw new ApiError('O servidor não confirmou a alteração da parada.', null, 'INVALID_STOP_STATUS_RESPONSE');
  return parsed.data;
}

export async function acceptAssignedTrip(token: string, tripId: number, clientEventId: string) {
  return apiRequest<{ accepted: true; session?: { tracking_stop_at?: string | null } }>(`/driver-app/trips/${tripId}/accept`, {
    method: 'POST', token, body: JSON.stringify({ clientEventId }),
  });
}

export type PendingReceiptItem = {
  stopId: number; tripId: number; invoiceNumber: string; customerName: string;
  companyId: number; companyCode: string | null; companyName: string | null; receiptGroupName: string;
};

export async function getPendingReceipts(token: string, tripId?: number | null) {
  const suffix = tripId ? `?tripId=${tripId}` : '';
  return apiRequest<{ total: number; groups: { companyId: number; companyName: string | null; receiptGroupName: string; invoiceNumbers: string[] }[]; items: PendingReceiptItem[] }>(`/driver-app/pending-receipts${suffix}`, { token });
}

export async function reorderTripStops(token: string, tripId: number, stopIds: number[], clientEventId: string) {
  const response = await apiRequest<unknown>(`/driver-app/trips/${tripId}/reorder`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      clientEventId,
      reason: 'Motorista selecionou a próxima entrega',
      items: stopIds.map((stopId, index) => ({ stopId, nextSequence: index + 1 })),
    }),
  });
  const parsed = reorderResponseSchema.safeParse(response);
  if (!parsed.success) throw new ApiError('O servidor não confirmou a nova ordem da rota.', null, 'INVALID_REORDER_RESPONSE');
  return parsed.data;
}

export async function getDriverTrackingConfig(token: string) {
  const response = await apiRequest<unknown>('/driver-app/tracking/config', { token });
  return trackingConfigSchema.parse(response).config;
}

export async function registerDriverLocation(token: string, location: {
  id: string;
  tripId: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}) {
  const response = await apiRequest<unknown>('/driver-app/tracking/location', {
    method: 'POST',
    token,
    body: JSON.stringify({
      trip_id: location.tripId,
      client_event_id: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_meters: location.accuracy,
      speed_kmh: location.speed === null ? null : location.speed * 3.6,
      heading: location.heading,
      recorded_at: location.recordedAt,
      source: 'mobile_background',
    }),
  });
  return locationResponseSchema.parse(response);
}
