import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Load data from the API; reloads when `path` or `reloadKey` changes
export function useApi(path, reloadKey = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await api(path), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [path]);

  useEffect(() => { load(); }, [load, reloadKey]);
  return { ...state, reload: load };
}
