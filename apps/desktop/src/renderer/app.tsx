import { useEffect, useState } from 'react';

import type { AppInfo } from '@museworks/contracts';

export function App() {
  const [appInfo, setAppInfo] = useState<AppInfo>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    window.museworks.app
      .getInfo()
      .then(setAppInfo)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#111318',
        color: '#f7f7f8',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section aria-live="polite" style={{ textAlign: 'center' }}>
        {failed ? (
          <p>Unable to read application information.</p>
        ) : appInfo ? (
          <>
            <h1>Museworks {appInfo.appVersion}</h1>
            <p>
              {appInfo.platform} · {appInfo.arch}
            </p>
          </>
        ) : (
          <p>Starting Museworks…</p>
        )}
      </section>
    </main>
  );
}
