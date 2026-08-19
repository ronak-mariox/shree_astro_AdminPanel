import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads something from the API and keeps the three states a screen needs:
 * what came back, whether it is still loading, and what went wrong.
 *
 *   const { data, loading, error, reload } = useApi(() => listUsers({ page }), [page]);
 *
 * The loader re-runs whenever a value in `deps` changes. A response that
 * arrives after the component has moved on is thrown away, so a slow request
 * cannot overwrite a newer one — which is exactly what happens when somebody
 * types in a search box.
 */
export function useApi(loader, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  /** Bumped on every run; a result from an older run is ignored. */
  const runId = useRef(0);

  /**
   * The loader is a new closure on every render, so it cannot be a dependency
   * without re-running forever. It is held in a ref, and the *values* in `deps`
   * decide when to reload instead — flattened to a string, because a dependency
   * list has to be a literal array.
   */
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const depsKey = JSON.stringify(deps);

  const run = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return;
    }

    const id = (runId.current += 1);
    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current();
      if (runId.current === id) {
        setData(result);
      }
    } catch (caught) {
      if (runId.current === id) {
        setError(caught);
      }
    } finally {
      if (runId.current === id) {
        setLoading(false);
      }
    }
    /** depsKey stands in for the caller's deps; see the ref above. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, depsKey]);

  useEffect(() => {
    /**
     * Fetching on mount is what this hook is for, and it necessarily sets state
     * from inside the effect. The lint rule guards against cascading renders in
     * general; here the cascade is the point, and `runId` already makes a stale
     * response harmless.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();

    /** A pending result is discarded if the component unmounts first. */
    return () => {
      runId.current += 1;
    };
  }, [run]);

  return { data, loading, error, reload: run, setData };
}

/**
 * Runs a write and reports whether it is in flight.
 *
 *   const [run, busy] = useAction(notify);
 *   run(() => blockUser(id), { success: 'User blocked', onDone: reload });
 *
 * A failure becomes a toast rather than a thrown error, because every write in
 * the panel is a button press, and a button press should never blank the screen.
 */
export function useAction(notify) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action, { success, onDone } = {}) => {
      setBusy(true);
      try {
        const result = await action();
        if (success) {
          notify(success, { tone: 'success' });
        }
        await onDone?.(result);
        return result;
      } catch (error) {
        notify(error.message || 'Something went wrong', { tone: 'danger' });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  return [run, busy];
}
