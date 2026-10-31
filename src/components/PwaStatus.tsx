import { useEffect, useLayoutEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** How long the "ready offline" note stays before it goes away on its own. The update prompt stays until answered. */
const OFFLINE_READY_MS = 4000;

/** Shows "ready offline" once and an "update available" prompt when a new version is deployed. */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    }
  });
  const showOfflineReady = offlineReady && !needRefresh;
  const visible = offlineReady || needRefresh;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showOfflineReady) return;
    const t = window.setTimeout(() => setOfflineReady(false), OFFLINE_READY_MS);
    return () => window.clearTimeout(t);
  }, [showOfflineReady, setOfflineReady]);
  // The bar is docked above the bottom nav and never over content: while it shows, the page gets the same
  // amount of extra bottom padding (--toast-h, measured so a two-line update prompt counts too).
  useLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!visible || !el) {
      root.style.removeProperty('--toast-h');
      return;
    }
    const measure = () => root.style.setProperty('--toast-h', `${el.offsetHeight}px`);
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--toast-h');
    };
  }, [visible, needRefresh]);
  if (!visible) return null;
  return (
    <div className={`toast${needRefresh ? ' update' : ''}`} role="status" ref={ref}>
      {needRefresh ? (
        <>
          <span>A new version (or updated content) is available.</span>
          <span className="toast-actions">
            <button className="primary" onClick={() => updateServiceWorker(true)}>Reload</button>
            <button onClick={() => setNeedRefresh(false)}>Later</button>
          </span>
        </>
      ) : (
        <>
          <span>Ready to work offline</span>
          <span className="toast-actions">
            <button onClick={() => setOfflineReady(false)}>OK</button>
          </span>
        </>
      )}
    </div>
  );
}
