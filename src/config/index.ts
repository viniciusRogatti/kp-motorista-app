import Constants from 'expo-constants';
import { z } from 'zod';

import { assertEnvironmentSafe, type PublicEnvironment } from './environment';

const publicEnvironmentSchema = z.object({
  appEnv: z.enum(['development', 'preview', 'production']),
  apiUrl: z.url(),
  socketUrl: z.url(),
  sentryDsn: z.string().default(''),
  mapProvider: z.string().min(1),
  buildChannel: z.string().min(1),
  buildDate: z.string().min(1),
  commitSha: z.string().default(''),
  operationsMode: z.enum(['observation', 'simulation', 'live']).default('observation'),
});

const embedded = Constants.expoConfig?.extra ?? {};
const runtimeEnvironment = {
  ...embedded,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV || embedded.appEnv,
  apiUrl: process.env.EXPO_PUBLIC_API_URL || embedded.apiUrl,
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || embedded.socketUrl,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? embedded.sentryDsn,
  mapProvider: process.env.EXPO_PUBLIC_MAP_PROVIDER || embedded.mapProvider,
  buildChannel: process.env.EXPO_PUBLIC_BUILD_CHANNEL || embedded.buildChannel,
  operationsMode: process.env.EXPO_PUBLIC_OPERATIONS_MODE || embedded.operationsMode || 'observation',
};

const parsed = publicEnvironmentSchema.safeParse(runtimeEnvironment);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Configuracao publica invalida. Revise app.config.ts e .env (${fields}).`);
}

export const appConfig: PublicEnvironment = assertEnvironmentSafe(parsed.data);
export const isNonProduction = appConfig.appEnv !== 'production';

if (__DEV__) {
  console.info(`[config] ${appConfig.appEnv} API=${new URL(appConfig.apiUrl).origin} channel=${appConfig.buildChannel}`);
}
