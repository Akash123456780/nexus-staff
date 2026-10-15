import { StorageService } from '../services/storage';
import { ApiResponse } from '../types';

export class ApiError extends Error {
  isOffline: boolean;
  status?: number;
  originalError?: any;

  constructor(message: string, isOffline = false, status?: number, originalError?: any) {
    super(message);
    this.name = 'ApiError';
    this.isOffline = isOffline;
    this.status = status;
    this.originalError = originalError;
  }
}

type UnauthorizedHandler = () => void;
type ConnectionStatusHandler = (online: boolean) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
const connectionListeners = new Set<ConnectionStatusHandler>();

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function addConnectionListener(handler: ConnectionStatusHandler) {
  connectionListeners.add(handler);
  return () => {
    connectionListeners.delete(handler);
  };
}

function notifyConnection(online: boolean) {
  connectionListeners.forEach((listener) => {
    try {
      listener(online);
    } catch {
      // Ignore listener error
    }
  });
}

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  timeoutMs?: number;
}

export async function apiClient<T = any>(
  path: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const serverUrl = await StorageService.getServerUrl();
  if (!serverUrl) {
    throw new ApiError('Please set the shop PC address first.', false);
  }

  const token = await StorageService.getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${serverUrl}${normalizedPath}`;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchBody = options.body && !isFormData ? JSON.stringify(options.body) : options.body;

    const res = await fetch(fullUrl, {
      ...options,
      body: fetchBody,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    notifyConnection(true);

    if (res.status === 401) {
      await StorageService.clearToken();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
      throw new ApiError('Session expired. Please sign in again.', false, 401);
    }

    let json: ApiResponse<T> | null = null;
    try {
      json = await res.json();
    } catch {
      // Body was not json
    }

    if (!res.ok) {
      const errMsg = json?.error?.message || `Server error (${res.status})`;
      throw new ApiError(errMsg, false, res.status);
    }

    if (json && json.success === false) {
      throw new ApiError(json.error?.message || 'Request failed', false, res.status);
    }

    // Return inner data according to API spec:
    // Every response is { success, data, requestId, timestamp }
    return (json?.data !== undefined ? json.data : (json as unknown as T));
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    // Network / timeout / offline error
    notifyConnection(false);

    if (err.name === 'AbortError') {
      throw new ApiError('Connection timed out. Shop computer did not respond.', true);
    }

    throw new ApiError(
      'The shop computer cannot be reached. Check Wi-Fi connection.',
      true,
      0,
      err
    );
  }
}
