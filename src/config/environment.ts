export type AppEnvironment = 'development' | 'preview' | 'production';

export type PublicEnvironment = {
  appEnv: AppEnvironment;
  apiUrl: string;
  socketUrl: string;
  sentryDsn: string;
  mapProvider: string;
  buildChannel: string;
  buildDate: string;
  commitSha: string;
  operationsMode: 'observation' | 'simulation' | 'live';
};

export function isLocalHostUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return ['localhost', '127.0.0.1', '10.0.2.2'].includes(hostname);
  } catch {
    return false;
  }
}

export function assertEnvironmentSafe(environment: PublicEnvironment) {
  if (!['development', 'preview', 'production'].includes(environment.appEnv)) {
    throw new Error('Ambiente do aplicativo invalido.');
  }

  for (const [name, value] of [
    ['API', environment.apiUrl],
    ['Socket', environment.socketUrl],
  ] as const) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${name} precisa usar http ou https.`);
    }
  }

  if (environment.appEnv === 'production' && isLocalHostUrl(environment.apiUrl)) {
    throw new Error('A API de producao nao pode apontar para localhost.');
  }

  return environment;
}
