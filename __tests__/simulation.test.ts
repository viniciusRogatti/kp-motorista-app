import { createSimulationTrip, moveSimulatedClient, reorderSimulatedClients, updateSimulatedStatus } from '../src/features/trips/simulation';
import type { AssignedTrip } from '../src/types/trip';

function stop(id: number, sequence: number, customerId: string, status = 'delivered') {
  return {
    id, companyId: 1, companyCode: 'marerio', sequence, invoiceNumber: String(100 + id),
    customerName: `Cliente ${customerId}`, city: 'Limeira', status, grossWeight: 10,
    boxQuantity: 1, customerId, phone: null, address: '', addressNumber: '', neighborhood: '',
    state: 'SP', zipCode: '', representativeName: null, receiptGroupName: null, products: [], updatedAt: null,
  };
}

const trip: AssignedTrip = {
  id: 1,
  date: '2026-08-03',
  runNumber: 1,
  grossWeight: 40,
  status: 'completed',
  updatedAt: null,
  driver: { id: 1, name: 'Jonathan' },
  vehicle: { id: 1, model: 'VUC', licensePlate: 'ABC1D23' },
  summary: { totalStops: 4, completedStops: 4, pendingStops: 0 },
  tracking: { acceptedAt: null, active: false, operationalCompletedAt: null, stopAt: null },
  stops: [stop(1, 1, 'A'), stop(2, 2, 'B'), stop(3, 3, 'A'), stop(4, 4, 'C')],
};

describe('simulação local da rota', () => {
  it('sempre começa com todas as notas pendentes', () => {
    const simulated = createSimulationTrip(trip)!;
    expect(simulated.stops.every((item) => item.status === 'pending')).toBe(true);
    expect(simulated.summary).toEqual({ totalStops: 4, completedStops: 0, pendingStops: 4 });
  });

  it('atualiza status e progresso sem alterar a rota original', () => {
    const simulated = createSimulationTrip(trip)!;
    const changed = updateSimulatedStatus(simulated, 1, 'delivered');
    expect(changed.summary.completedStops).toBe(1);
    expect(trip.stops[0].status).toBe('delivered');
    expect(simulated.stops[0].status).toBe('pending');
  });

  it('move juntas as notas do mesmo cliente', () => {
    const simulated = createSimulationTrip(trip)!;
    const changed = moveSimulatedClient(simulated, 2, 'top');
    expect(changed.stops.map((item) => item.id)).toEqual([2, 1, 3, 4]);
    expect(changed.stops.map((item) => item.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('reordena os blocos arrastados e ativa a nova primeira entrega', () => {
    const simulated = createSimulationTrip(trip)!;
    const changed = reorderSimulatedClients(simulated, [2, 1, 3, 4], true);

    expect(changed.stops.map((item) => item.id)).toEqual([2, 1, 3, 4]);
    expect(changed.stops.map((item) => item.status)).toEqual(['on_the_way', 'pending', 'pending', 'pending']);
  });
});
