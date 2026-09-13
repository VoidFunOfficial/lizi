import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { fetchRelease, RELEASE_API } from './release.ts';

export function checkLatestRelease() {
  return fetchRelease(async () => {
    if (Capacitor.isNativePlatform()) {
      return CapacitorHttp.get({
        url: RELEASE_API,
        headers: {
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache',
        },
        responseType: 'json',
        connectTimeout: 10000,
        readTimeout: 10000,
      });
    }
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
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
