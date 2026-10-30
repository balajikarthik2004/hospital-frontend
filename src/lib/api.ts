import axios, { AxiosError } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'safedischarge.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Lets the auth store react to a 401 without importing it here. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; details?: unknown }>) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

/** Turns an axios failure into a message worth showing a clinician. */
export function errorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ error?: string; details?: unknown }>;
  const data = axiosErr.response?.data;

  if (data?.error) {
    const details = data.details;
    if (Array.isArray(details) && details.length) {
      return `${data.error}: ${details.join('; ')}`;
    }
    if (details && typeof details === 'object') {
      const fields = Object.entries(details as Record<string, string[]>)
        .map(([field, msgs]) => `${field} — ${(msgs ?? []).join(', ')}`)
        .join('; ');
      return fields ? `${data.error}: ${fields}` : data.error;
    }
    return data.error;
  }

  if (axiosErr.code === 'ERR_NETWORK') {
    return 'Cannot reach the API server. Is it running on port 5000?';
  }
  return axiosErr.message || 'Something went wrong';
}
