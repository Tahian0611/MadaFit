/**
 * Custom React hooks for API data fetching
 * Simplifies state management and loading/error handling
 */

import { useEffect, useState, useCallback } from 'react';
import type { QueryParams, ApiListResponse } from '../types/entities';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Generic hook for fetching data from API
 * Usage: const { data, loading, error } = useFetch(fetchFn)
 */
export function useFetch<T>(
  fetchFn: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setState({ data: null, loading: true, error: null });
        const result = await fetchFn();
        if (isMounted) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return state;
}

/**
 * Hook for fetching paginated data
 * Usage: const { items, total, page, setPage, loading, error } = usePaginatedFetch(fetchFn, itemsPerPage)
 */
export function usePaginatedFetch<T>(
  fetchFn: (params: QueryParams) => Promise<ApiListResponse<T>>,
  itemsPerPage = 10
) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetchFn({
          page,
          itemsPerPage,
        });

        if (isMounted) {
          setItems(response['hydra:member']);
          setTotal(response['hydra:totalItems']);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [page, itemsPerPage, fetchFn]);

  return { items, total, page, setPage, loading, error };
}

/**
 * Hook for searching data
 * Usage: const { results, search, loading } = useSearch(searchFn)
 */
export function useSearch<T>(
  searchFn: (query: string) => Promise<ApiListResponse<T>>
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const response = await searchFn(searchQuery);
        setResults(response['hydra:member']);
        setQuery(searchQuery);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchFn]
  );

  return { query, results, loading, search, setResults };
}

/**
 * Hook for managing form submissions with API calls
 * Usage: const { submit, loading, error } = useApiMutation(mutationFn)
 */
export function useApiMutation<TData, TResponse>(
  mutationFn: (data: TData) => Promise<TResponse>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TResponse | null>(null);

  const submit = useCallback(
    async (submitData: TData) => {
      try {
        setLoading(true);
        setError(null);
        const result = await mutationFn(submitData);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  return { submit, loading, error, data };
}

/**
 * Hook for managing form state with validation
 * Usage: const { values, errors, handleChange, handleSubmit } = useForm(initialValues, onSubmit)
 */
export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>,
  validate?: (values: T) => Record<string, string>
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const finalValue =
      type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number'
          ? parseFloat(value)
          : value;

    setValues((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    // Validate on blur
    if (validate) {
      const newErrors = validate(values);
      if (newErrors[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: newErrors[name],
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate all fields
    if (validate) {
      const newErrors = validate(values);
      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit(values);
      setValues(initialValues);
      setTouched({});
    } catch (error) {
      console.error('Form submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
  };
}
