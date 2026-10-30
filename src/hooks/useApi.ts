import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

/**
 * GETs a URL and keeps the result. Pass `null` as the url to skip the request
 * (useful while a dependent id is still unknown).
 */
export function useApi<T>(url: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    const requestId = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(url);
      if (requestId === latest.current) setDataState(res.data);
    } catch (err) {
      if (requestId === latest.current) setError(errorMessage(err));
    } finally {
      if (requestId === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  const setData = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setDataState((prev) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T | null)(prev) : updater
    );
  }, []);

  return { data, loading, error, refetch: fetchData, setData };
}

/** Wraps a mutating request with pending + error state. */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        setError(errorMessage(err));
        return null;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return { mutate, pending, error, clearError: () => setError(null) };
}
