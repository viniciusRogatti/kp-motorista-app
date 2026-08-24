import type { AssignedTrip } from '@/types/trip';

type Stop = AssignedTrip['stops'][number];
export type SimulatedStatus = 'pending' | 'on_the_way' | 'arrived' | 'delivered_pending_receipt' | 'delivered' | 'returned' | 'redelivery' | 'retained';
export type MoveDirection = 'top' | 'up' | 'down';

const finalStatuses = new Set<SimulatedStatus>(['delivered_pending_receipt', 'delivered', 'returned', 'redelivery', 'retained']);

function clientKey(stop: Stop) {
  return stop.customerName.trim().toLocaleLowerCase('pt-BR') || stop.customerId || `stop-${stop.id}`;
}

function withSummary(trip: AssignedTrip, stops: Stop[]): AssignedTrip {
  const normalizedStops = stops.map((stop, index) => ({ ...stop, sequence: index + 1 }));
  const completedStops = normalizedStops.filter((stop) => finalStatuses.has(stop.status as SimulatedStatus)).length;
  const active = normalizedStops.find((stop) => stop.status === 'arrived')
    || normalizedStops.find((stop) => stop.status === 'on_the_way');
  return {
    ...trip,
    status: active?.status || 'assigned',
    summary: {
      totalStops: normalizedStops.length,
      completedStops,
      pendingStops: normalizedStops.length - completedStops,
    },
    stops: normalizedStops,
  };
}

export function createSimulationTrip(trip: AssignedTrip | null) {
  if (!trip) return null;
  return withSummary(trip, trip.stops.map((stop) => ({ ...stop, status: 'pending' })));
}

export function updateSimulatedStatus(trip: AssignedTrip, stopId: number, status: SimulatedStatus) {
  return withSummary(trip, trip.stops.map((stop) => stop.id === stopId ? { ...stop, status } : stop));
}

function groupOpenStops(stops: Stop[]) {
  const groups = new Map<string, Stop[]>();
  for (const stop of stops) {
    const key = clientKey(stop);
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
}

export function moveSimulatedClient(trip: AssignedTrip, stopId: number, direction: MoveDirection) {
  const openStops = trip.stops.filter((stop) => !finalStatuses.has(stop.status as SimulatedStatus));
  const finishedStops = trip.stops.filter((stop) => finalStatuses.has(stop.status as SimulatedStatus));
  const selected = openStops.find((stop) => stop.id === stopId);
  if (!selected) return trip;

  const groups = groupOpenStops(openStops);
  const selectedIndex = groups.findIndex((group) => group.key === clientKey(selected));
  const nextIndex = direction === 'top'
    ? 0
    : direction === 'up'
      ? Math.max(0, selectedIndex - 1)
      : Math.min(groups.length - 1, selectedIndex + 1);
  if (selectedIndex < 0 || selectedIndex === nextIndex) return trip;

  const [selectedGroup] = groups.splice(selectedIndex, 1);
  groups.splice(nextIndex, 0, selectedGroup);
  return withSummary(trip, [...groups.flatMap((group) => group.items), ...finishedStops]);
}

export function reorderSimulatedClients(trip: AssignedTrip, orderedStopIds: number[], activateFirst = false) {
  const openStops = trip.stops.filter((stop) => !finalStatuses.has(stop.status as SimulatedStatus));
  const finishedStops = trip.stops.filter((stop) => finalStatuses.has(stop.status as SimulatedStatus));
  const openById = new Map(openStops.map((stop) => [stop.id, stop]));
  const uniqueIds = Array.from(new Set(orderedStopIds));

  if (uniqueIds.length !== openStops.length || uniqueIds.some((id) => !openById.has(id))) return trip;

  const reorderedOpen = uniqueIds.map((id) => openById.get(id)!);
  const nextFirstKey = reorderedOpen[0] ? clientKey(reorderedOpen[0]) : null;

  if (activateFirst && nextFirstKey) {
    for (let index = 0; index < reorderedOpen.length; index += 1) {
      const stop = reorderedOpen[index];
      if (clientKey(stop) === nextFirstKey) {
        reorderedOpen[index] = { ...stop, status: 'on_the_way' };
      } else if (stop.status === 'on_the_way' || stop.status === 'arrived') {
        reorderedOpen[index] = { ...stop, status: 'pending' };
      }
    }
  }

  return withSummary(trip, [...reorderedOpen, ...finishedStops]);
}
