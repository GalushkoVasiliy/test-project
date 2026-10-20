import { useSessionStore, type Tokens } from '@/stores/session';

import { API_URL } from './config';
import { ApiError, NetworkError } from './errors';
import type { AccessTokenResponse, ProblemDetails } from './types';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  /** Attach the bearer token (default). */
  auth?: boolean;
  /** Use this access token instead of the session's (right after sign-in). */
  token?: string;
  signal?: AbortSignal;
}

/** Refresh a little before the access token expires. */
const REFRESH_MARGIN_MS = 60_000;

let refreshInFlight: Promise<string | null> | null = null;
let onSessionExpired: () => Promise<void> = async () => {};

/** Called when the server rejects the refresh token: the user has to sign in again. */
export function setSessionExpiredHandler(handler: () => Promise<void>) {
  onSessionExpired = handler;
}

export function toTokens(response: AccessTokenResponse): Tokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
  };
}

/**
 * Typed JSON request to the API. Every authenticated request carries the bearer token; an expired
 * token is refreshed once (shared by concurrent requests) and the request is retried.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, token, signal } = options;
  const url = `${API_URL}${path}${toQueryString(query)}`;

  const send = (accessToken?: string) =>
    request(url, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await send(token ?? (auth ? await currentAccessToken() : undefined));

  if (auth && !token && response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw new ApiError(401, { title: 'Your session has expired. Please sign in again.' });
    }
    response = await send(refreshed);
  }

  return parse<T>(response);
}

async function currentAccessToken(): Promise<string | undefined> {
  const tokens = useSessionStore.getState().tokens;
  if (!tokens) {
    return undefined;
  }

  if (tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }

  return (await refreshAccessToken()) ?? tokens.accessToken;
}

/**
 * Exchanges the refresh token for a new token pair. Offline this throws a NetworkError and the user
 * stays signed in; only an explicit rejection from the server ends the session.
 */
function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useSessionStore.getState().tokens?.refreshToken;
  if (!refreshToken) {
    return Promise.resolve(null);
  }

  refreshInFlight ??= (async () => {
    try {
      const response = await request(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 401 || response.status === 400) {
        await onSessionExpired();
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const tokens = toTokens((await response.json()) as AccessTokenResponse);
      await useSessionStore.getState().setTokens(tokens);
      return tokens.accessToken;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new NetworkError(error);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = response.status === 204 ? '' : await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    throw new ApiError(response.status, isProblem(data) ? data : null);
  }

  return data as T;
}

function isProblem(value: unknown): value is ProblemDetails {
  return typeof value === 'object' && value !== null && ('title' in value || 'detail' in value);
}

function toQueryString(query?: QueryParams): string {
  if (!query) {
    return '';
  }

  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return params.length ? `?${params.join('&')}` : '';
}
