// Fetches JSON and re-fetches when url or version changes.
// While a live refresh runs, the old numbers stay on screen; when the url itself changes,
// the old page's data is hidden at once so one room never shows another room's numbers.
import { useEffect, useState } from 'react';
import { getJSON } from './api.js';

export function useApi(url, version = 0) {
  const [state, setState] = useState({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return undefined;
    const ctrl = new AbortController();
    getJSON(url, { signal: ctrl.signal })
      .then((data) => setState({ url, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ url, data: null, error });
      });
    return () => ctrl.abort();
  }, [url, version]);
  const current = state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(url) && (!current || (!state.data && !state.error)),
  };
}
