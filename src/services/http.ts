import { appConfig } from '@/config';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiUrl(path: string) {
  return `${appConfig.apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text ? { message: text } : null;
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback;
  const candidate = 'message' in body ? body.message : 'error' in body ? body.error : null;
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { token, timeoutMs = 10_000, headers, ...requestOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl(path), {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
    const body = await readResponseBody(response);
    if (!response.ok) {
      const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
        ? body.code
        : undefined;
      throw new ApiError(errorMessage(body, `Falha HTTP ${response.status}.`), response.status, code);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (__DEV__) {
      console.warn('[http] falha de rede', {
        path,
        apiOrigin: new URL(appConfig.apiUrl).origin,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'O servidor demorou demais para responder.'
      : 'Não foi possível conectar ao servidor.';
    throw new ApiError(message, null);
  } finally {
    clearTimeout(timeout);
  }
}
