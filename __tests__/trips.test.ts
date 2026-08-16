jest.mock('../src/services/http', () => {
  class MockApiError extends Error {
    readonly status: number | null;
    readonly code?: string;

    constructor(message: string, mockStatus: number | null, mockCode?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = mockStatus;
      this.code = mockCode;
    }
  }
  return { ApiError: MockApiError, apiRequest: jest.fn() };
});

import {
  acceptAssignedTrip,
  getPendingReceipts,
  getAssignedTrip,
  registerDriverLocation,
  reorderTripStops,
  updateTripStopStatus,
} from '../src/services/trips';
import { apiRequest } from '../src/services/http';

const requestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('viagem atribuída', () => {
  beforeEach(() => requestMock.mockReset());

  it('aceita ausência de viagem e mantém o horário do servidor', async () => {
    requestMock.mockResolvedValueOnce({ trip: null, serverTime: '2026-08-02T18:00:00.000Z' });
    await expect(getAssignedTrip('token', 12)).resolves.toEqual({
      trip: null,
      serverTime: '2026-08-02T18:00:00.000Z',
    });
  });

  it('valida e entrega as paradas do snapshot mobile', async () => {
    requestMock.mockResolvedValueOnce({
      serverTime: '2026-08-02T18:00:00.000Z',
      trip: {
        id: 91,
        date: '2026-08-02',
        runNumber: 1,
        grossWeight: 100,
        status: 'assigned',
        updatedAt: null,
        driver: { id: 12, name: 'Jonathan' },
        vehicle: { id: 7, model: 'VUC', licensePlate: 'ABC1D23' },
        summary: { totalStops: 1, completedStops: 0, pendingStops: 1 },
        stops: [{
          id: 3,
          sequence: 1,
          invoiceNumber: '102',
          customerName: 'Cliente',
          city: 'Santos',
          status: 'pending',
          grossWeight: 100,
          boxQuantity: null,
          updatedAt: null,
        }],
      },
    });

    const result = await getAssignedTrip('token', 12);
    expect(result.trip?.driver.name).toBe('Jonathan');
    expect(result.trip?.stops).toHaveLength(1);
    expect(requestMock).toHaveBeenCalledWith('/driver-app/trips/assigned', { token: 'token' });
  });

  it('completa produtos e endereço por leitura quando o snapshot mobile não traz detalhes', async () => {
    requestMock
      .mockResolvedValueOnce({
        serverTime: '2026-08-02T18:00:00.000Z',
        trip: {
          id: 91,
          date: '2026-08-02',
          runNumber: 1,
          grossWeight: 100,
          status: 'assigned',
          updatedAt: null,
          driver: { id: 12, name: 'Jonathan' },
          vehicle: { id: 7, model: 'VUC', licensePlate: 'ABC1D23' },
          summary: { totalStops: 1, completedStops: 0, pendingStops: 1 },
          stops: [{
            id: 3,
            sequence: 1,
            invoiceNumber: '102',
            customerName: 'Cliente',
            city: 'Santos',
            status: 'pending',
            grossWeight: 100,
            boxQuantity: null,
            updatedAt: null,
          }],
        },
      })
      .mockResolvedValueOnce({
        trips: [{
          id: 91,
          driver_id: 12,
          car_id: 7,
          date: '2026-08-02',
          run_number: 1,
          gross_weight: '100',
          Driver: { id: 12, name: 'Jonathan' },
          Car: { id: 7, model: 'VUC', license_plate: 'ABC1D23' },
          TripNotes: [{
            id: 3,
            company_id: 2,
            company_code: 'mar-e-rio',
            order: 1,
            invoice_number: '102',
            customer_name: 'Cliente',
            city: 'Santos',
            status: 'delivered',
            gross_weight: '100',
            address: 'Rua do Porto',
            address_number: '25',
            products: [{ code: 'P-1', description: 'Pescado', type: 'CX', quantity: 4 }],
          }],
        }],
      });

    const result = await getAssignedTrip('token', 12);

    expect(result.trip?.stops[0]).toMatchObject({
      status: 'pending',
      companyCode: 'mar-e-rio',
      address: 'Rua do Porto',
      addressNumber: '25',
      products: [{ code: 'P-1', description: 'Pescado', type: 'CX', quantity: 4 }],
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, '/trips/search/driver/12', { token: 'token' });
  });

  it('usa o endpoint legado somente quando o endpoint mobile ainda não foi publicado', async () => {
    const { ApiError } = jest.requireMock('../src/services/http') as typeof import('../src/services/http');
    requestMock
      .mockRejectedValueOnce(new ApiError('Não encontrado', 404))
      .mockResolvedValueOnce({
        trips: [{
          id: 91,
          driver_id: 12,
          car_id: 7,
          date: '2026-08-02',
          run_number: 1,
          gross_weight: '100',
          Driver: { id: 12, name: 'Jonathan' },
          Car: { id: 7, model: 'VUC', license_plate: 'ABC1D23' },
          TripNotes: [{
            id: 3,
            order: 1,
            invoice_number: '102',
            customer_name: 'Cliente',
            city: 'Santos',
            status: 'pending',
            gross_weight: '100',
          }],
        }],
      });

    const result = await getAssignedTrip('token', 12);
    expect(result.trip?.id).toBe(91);
    expect(requestMock).toHaveBeenNthCalledWith(2, '/trips/search/driver/12', { token: 'token' });
  });

  it('envia alteração de status com idempotência', async () => {
    requestMock.mockResolvedValueOnce({ accepted: true, stop: { id: 3, status: 'on_the_way' } });

    await expect(updateTripStopStatus('token', 3, 'on_the_way', 'event-1')).resolves.toMatchObject({ accepted: true });
    expect(requestMock).toHaveBeenCalledWith('/driver-app/trip-stops/3/status', expect.objectContaining({
      method: 'POST',
      token: 'token',
      body: expect.stringContaining('event-1'),
    }));
  });

  it('registra aceite formal da rota', async () => {
    requestMock.mockResolvedValueOnce({ accepted: true });
    await expect(acceptAssignedTrip('token', 91, 'accept-1')).resolves.toMatchObject({ accepted: true });
    expect(requestMock).toHaveBeenCalledWith('/driver-app/trips/91/accept', expect.objectContaining({
      method: 'POST', token: 'token', body: expect.stringContaining('accept-1'),
    }));
  });

  it('carrega somente as NFs entregues que aguardam foto', async () => {
    requestMock.mockResolvedValueOnce({ total: 1, groups: [], items: [{
      stopId: 3, tripId: 91, invoiceNumber: '102', customerName: 'Cliente', companyId: 2,
      companyCode: 'mar_e_rio', companyName: 'MAR E RIO', receiptGroupName: 'KP - Canhotos',
    }] });
    const result = await getPendingReceipts('token', 91);
    expect(result.items[0].receiptGroupName).toBe('KP - Canhotos');
    expect(requestMock).toHaveBeenCalledWith('/driver-app/pending-receipts?tripId=91', { token: 'token' });
  });

  it('envia a ordem completa e sequencial da rota', async () => {
    requestMock.mockResolvedValueOnce({
      accepted: true,
      trip_id: 91,
      items: [{ stop_id: 8, sequence: 1 }, { stop_id: 3, sequence: 2 }],
    });

    await expect(reorderTripStops('token', 91, [8, 3], 'event-2')).resolves.toMatchObject({ accepted: true });
    const options = requestMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({
      clientEventId: 'event-2',
      items: [{ stopId: 8, nextSequence: 1 }, { stopId: 3, nextSequence: 2 }],
    });
  });

  it('envia a posicao do motorista com identificador idempotente', async () => {
    requestMock.mockResolvedValueOnce({ accepted: true });

    await expect(registerDriverLocation('token', {
      id: 'location-1',
      tripId: 91,
      latitude: -22.91,
      longitude: -47.06,
      accuracy: 12,
      speed: 8,
      heading: 180,
      recordedAt: '2026-08-16T12:00:00.000Z',
    })).resolves.toMatchObject({ accepted: true });

    expect(requestMock).toHaveBeenCalledWith('/driver-app/tracking/location', expect.objectContaining({
      method: 'POST',
      token: 'token',
    }));
    const body = JSON.parse(String(requestMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      trip_id: 91,
      client_event_id: 'location-1',
      latitude: -22.91,
      longitude: -47.06,
      source: 'mobile_background',
    });
  });
});
