import { useRegisterSW } from 'virtual:pwa-register/react';

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
  if (!offlineReady && !needRefresh) return null;
  return (
    <div className="toast" role="status">
      {needRefresh ? (
        <>
          <span>A new version (or updated content) is available.</span>
          <button className="primary" onClick={() => updateServiceWorker(true)}>Reload</button>
          <button onClick={() => setNeedRefresh(false)}>Later</button>
        </>
      ) : (
        <>
          <span>Ready to work offline</span>
          <button onClick={() => setOfflineReady(false)}>OK</button>
        </>
      )}
    </div>
  );
}
