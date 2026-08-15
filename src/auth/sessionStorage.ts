import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import type { DriverSession } from './types';

const SESSION_KEY = 'kp.motorista.session.v1';

const storedSessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    permission: z.string().min(1),
    driverId: z.number().int().positive(),
    companyId: z.number().int().positive(),
    companyCode: z.string().nullable(),
    companyName: z.string().nullable(),
    name: z.string().nullable(),
    username: z.string().min(1),
  }),
});

export async function readStoredSession(): Promise<DriverSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;

  try {
    const parsed = storedSessionSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Conteudo legado ou corrompido e descartado abaixo.
  }

  await clearStoredSession();
  return null;
}

export async function writeStoredSession(session: DriverSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
