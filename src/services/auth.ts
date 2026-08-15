import { z } from 'zod';

import type { DriverSession, SessionValidation } from '@/auth/types';

import { ApiError, apiRequest } from './http';

const loginResponseSchema = z.object({
  token: z.string().min(1),
  data: z.object({
    permission: z.string().min(1),
    driverId: z.coerce.number().int().positive().nullable().optional(),
    companyId: z.coerce.number().int().positive(),
    companyCode: z.string().nullable().optional(),
    companyName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    username: z.string().min(1),
  }),
});

export async function loginDriver(username: string, password: string): Promise<DriverSession> {
  const response = await apiRequest<unknown>('/driver-app/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const parsed = loginResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new ApiError('O servidor retornou uma sessão inválida.', null, 'INVALID_LOGIN_RESPONSE');
  }

  if (!parsed.data.data.driverId) {
    await logoutDriver(parsed.data.token);
    throw new ApiError(
      'Este usuário não está vinculado a um motorista. Solicite o vínculo antes de acessar o aplicativo.',
      403,
      'DRIVER_LINK_REQUIRED',
    );
  }

  return {
    token: parsed.data.token,
    user: {
      permission: parsed.data.data.permission,
      driverId: parsed.data.data.driverId,
      companyId: parsed.data.data.companyId,
      companyCode: parsed.data.data.companyCode ?? null,
      companyName: parsed.data.data.companyName ?? null,
      name: parsed.data.data.name ?? null,
      username: parsed.data.data.username,
    },
  };
}

export async function validateDriverSession(token: string): Promise<SessionValidation> {
  try {
    const response = await apiRequest<{ valid?: boolean }>('/login/verifyToken', { token });
    return response.valid === true ? 'valid' : 'invalid';
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return 'invalid';
    return 'unavailable';
  }
}

export async function logoutDriver(token: string) {
  try {
    await apiRequest('/login/logout', { method: 'POST', body: JSON.stringify({}), token });
  } catch {
    // O logout local e obrigatorio mesmo se o backend estiver indisponivel.
  }
}
