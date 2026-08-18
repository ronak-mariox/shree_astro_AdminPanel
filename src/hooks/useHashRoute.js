import { useCallback, useEffect, useState } from 'react';

/**
 * A hash router in twenty lines — enough for a panel whose pages are flat and
 * whose detail views are drawers rather than routes. Deep links and the
 * browser's back button both work: `#/consultations` selects that page.
 */
export function useHashRoute(fallback = 'dashboard') {
  const read = () => window.location.hash.replace(/^#\/?/, '') || fallback;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback((next) => {
    window.location.hash = `/${next}`;
    window.scrollTo({ top: 0 });
  }, []);

  return [route, navigate];
}

/** Fire-and-forget toasts — the panel's confirmation of a write. */
export function useToasts(timeout = 2600) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback(
    (message, options = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, message, ...options }]);
      setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), timeout);
    },
    [timeout],
  );

  return [toasts, push];
}
