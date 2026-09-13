import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { fetchRelease, RELEASE_API, RELEASE_ACCEPT } from './release.ts';

export function checkLatestRelease() {
  return fetchRelease(async () => {
    if (Capacitor.isNativePlatform()) {
      return CapacitorHttp.get({
        url: RELEASE_API,
        headers: {
          Accept: RELEASE_ACCEPT,
          'Cache-Control': 'no-cache',
        },
        responseType: 'json',
        connectTimeout: 10000,
        readTimeout: 10000,
      });
    }
    // CNB does not grant our website CORS access; use a same-origin proxy.
    const response = await fetch('/api/updates', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(10000),
    });
    return {
      status: response.status,
      data: response.ok ? await response.json() : null,
    };
  });
}
