import * as React from 'react';
import { loadWorkspace, subscribeToWorkspace } from '../lib/api.js';

/**
 * Loads one workspace (by region: 'uk' or 'us') from Supabase and keeps it fresh with realtime.
 * Returns status 'demo' when not connected, so callers fall back to the built-in data.
 */
export function useLiveWorkspace(region, enabled) {
  const [state, setState] = React.useState({ region: null, status: 'loading', data: null, error: null });
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    loadWorkspace(region)
      .then(data => {
        if (!cancelled) setState({ region, status: data ? 'ready' : 'empty', data, error: null });
      })
      .catch(error => {
        console.error('[vult] could not load the workspace', error);
        if (!cancelled) setState({ region, status: 'error', data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [region, enabled, version]);

  const orgId = state.region === region && state.data ? state.data.orgId : null;
  React.useEffect(() => {
    if (!enabled || !orgId) return undefined;
    let timer = null;
    // Coalesce bursts of row changes into one reload.
    const unsubscribe = subscribeToWorkspace(orgId, () => {
      clearTimeout(timer);
      timer = setTimeout(() => setVersion(v => v + 1), 250);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, orgId]);

  if (!enabled) return { status: 'demo', data: null, error: null };
  if (state.region !== region) return { status: 'loading', data: null, error: null };
  return { status: state.status, data: state.data, error: state.error };
}
