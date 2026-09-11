import { parseXiaomiWeather, xiaomiWeatherUrl } from '@/lib/xiaomi-weather';

const RESPONSE_HEADERS = {
  'Cache-Control':
    'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(xiaomiWeatherUrl(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) {
      throw new Error(`上游服务返回 ${upstream.status}`);
    }

    const snapshot = parseXiaomiWeather(await upstream.json());
    return Response.json(snapshot, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error('Xiaomi weather request failed', error);
    return Response.json(
      { error: '天气服务暂时不可用' },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
