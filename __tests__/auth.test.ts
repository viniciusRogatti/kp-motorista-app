jest.mock('../src/services/http', () => {
  class MockApiError extends Error {
    readonly status: number | null;
    readonly code?: string;

    constructor(
      message: string,
      mockStatus: number | null,
      mockCode?: string,
    ) {
      super(message);
      this.name = 'ApiError';
      this.status = mockStatus;
      this.code = mockCode;
    }
  }

  return {
    ApiError: MockApiError,
    apiRequest: jest.fn(),
  };
});

import { loginDriver, validateDriverSession } from '../src/services/auth';
import { ApiError, apiRequest } from '../src/services/http';

const requestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('autenticação do motorista', () => {
  beforeEach(() => requestMock.mockReset());

  it('normaliza a sessão retornada pelo login', async () => {
    requestMock.mockResolvedValueOnce({
      token: 'token-seguro',
      data: {
        permission: 'user',
        driverId: 42,
        companyId: 7,
        companyCode: 'KP',
        companyName: 'KP Transportes',
        name: 'Jonathan',
        username: 'jonathan',
      },
    });

    await expect(loginDriver(' jonathan ', 'senha')).resolves.toEqual({
      token: 'token-seguro',
      user: {
        permission: 'user',
        driverId: 42,
        companyId: 7,
        companyCode: 'KP',
        companyName: 'KP Transportes',
        name: 'Jonathan',
        username: 'jonathan',
      },
    });
    expect(requestMock).toHaveBeenCalledWith('/driver-app/auth/login', expect.objectContaining({
      body: JSON.stringify({ username: 'jonathan', password: 'senha' }),
    }));
  });

  it('recusa usuário sem vínculo de motorista e encerra a sessão criada', async () => {
    requestMock
      .mockResolvedValueOnce({
        token: 'token-sem-motorista',
        data: {
          permission: 'user',
          driverId: null,
          companyId: 7,
          username: 'operador',
        },
      })
      .mockResolvedValueOnce({ success: true });

    await expect(loginDriver('operador', 'senha')).rejects.toMatchObject({
      status: 403,
      code: 'DRIVER_LINK_REQUIRED',
    });
    expect(requestMock).toHaveBeenLastCalledWith('/login/logout', expect.objectContaining({
      token: 'token-sem-motorista',
    }));
  });

  it('distingue token inválido de backend temporariamente indisponível', async () => {
    requestMock.mockRejectedValueOnce(new ApiError('Token inválido', 401));
    await expect(validateDriverSession('expirado')).resolves.toBe('invalid');

    requestMock.mockRejectedValueOnce(new ApiError('Sem conexão', null));
    await expect(validateDriverSession('sessao-offline')).resolves.toBe('unavailable');
  });
});
