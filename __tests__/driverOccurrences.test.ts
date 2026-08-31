import { createDriverOccurrence } from '@/services/driverOccurrences';
import { apiRequest } from '@/services/http';

jest.mock('@/services/http', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
    }
  },
  apiRequest: jest.fn(),
}));

const apiRequestMock = jest.mocked(apiRequest);

describe('driverOccurrences', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({
      accepted: true,
      occurrence: {
        id: 9,
        type: 'redelivery',
        statusApplied: true,
        communicationStatus: 'prepared',
        whatsappGroupName: 'KP Acertos',
        shareMessage: 'REENTREGA da NF 1749782',
        hasEvidence: false,
      },
    });
  });

  it('envia ocorrência sem foto como JSON no Android', async () => {
    await createDriverOccurrence('token', 42, {
      occurrenceType: 'redelivery',
      reason: 'NÃO HOUVE TEMPO PARA IR AO LOCAL',
      clientEventId: 'event-1',
    });

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [path, options] = apiRequestMock.mock.calls[0];
    expect(path).toBe('/driver-app/trip-stops/42/occurrences');
    expect(options).toBeDefined();
    expect(typeof options?.body).toBe('string');
    expect(JSON.parse(options?.body as string)).toEqual({
      occurrenceType: 'redelivery',
      returnScope: null,
      retentionKind: null,
      reason: 'NÃO HOUVE TEMPO PARA IR AO LOCAL',
      description: '',
      items: [],
      clientEventId: 'event-1',
    });
  });
});
