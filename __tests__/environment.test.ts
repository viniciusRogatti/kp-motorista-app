import { assertEnvironmentSafe, isLocalHostUrl, type PublicEnvironment } from '@/config/environment';

const base: PublicEnvironment = {
  appEnv: 'preview',
  apiUrl: 'https://api.homologacao.example',
  socketUrl: 'https://socket.homologacao.example',
  sentryDsn: '',
  mapProvider: 'external',
  buildChannel: 'preview',
  buildDate: '2026-08-02T00:00:00.000Z',
  commitSha: '',
  operationsMode: 'observation',
};

describe('environment safety', () => {
  test('detecta hosts locais usados no desenvolvimento', () => {
    expect(isLocalHostUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isLocalHostUrl('http://10.0.2.2:3000')).toBe(true);
    expect(isLocalHostUrl(base.apiUrl)).toBe(false);
  });

  test('aceita homologacao explicita', () => {
    expect(assertEnvironmentSafe(base)).toBe(base);
  });

  test('bloqueia localhost em producao', () => {
    expect(() => assertEnvironmentSafe({
      ...base,
      appEnv: 'production',
      apiUrl: 'http://localhost:3000',
    })).toThrow('producao');
  });
});
