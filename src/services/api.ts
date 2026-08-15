import { appConfig } from '@/config';

export async function checkApiHealth(signal?: AbortSignal) {
  const startedAt = Date.now();
  const response = await fetch(appConfig.apiUrl, { method: 'GET', signal });
  return { ok: response.ok, status: response.status, latencyMs: Date.now() - startedAt };
}
