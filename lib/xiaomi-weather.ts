import { JIANGYIN_CAMPUS_CENTER } from './njust-jiangyin-reference.ts';
import { HOUR_MILLISECONDS, startOfCampusHour } from './campus-time.ts';

const XIAOMI_WEATHER_ENDPOINT =
  'https://weatherapi.market.xiaomi.com/wtr-v3/weather/all';
const XIAOMI_WEATHER_APP_KEY = 'weather20151024';
const XIAOMI_WEATHER_SIGN = 'zUFJoAR2ZVrDy1vF3D07';

export const JIANGYIN_WEATHER_LOCATION = {
  name: '江阴校区',
  locationKey: 'weathercn:101190202',
  ...JIANGYIN_CAMPUS_CENTER,
} as const;

export type WeatherSnapshot = {
  location: typeof JIANGYIN_WEATHER_LOCATION;
  weatherCode: number;
  weatherLabel: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  aqi?: number;
  high?: number;
  low?: number;
  publishedAt: string;
  hourly: HourlyWeather[];
};

export type HourlyWeather = {
  at: string;
  weatherCode: number;
  weatherLabel: string;
};

export type WeatherAtTime =
  | {
      status: 'matched';
      source: 'current' | 'hourly';
      at: string;
      weatherCode: number;
      weatherLabel: string;
    }
  | { status: 'unavailable'; reason: 'outside-forecast' };

const WEATHER_LABELS: Record<number, string> = {
  0: '晴',
  1: '多云',
  2: '阴',
  3: '阵雨',
  4: '雷阵雨',
  5: '雷阵雨伴冰雹',
  6: '雨夹雪',
  7: '小雨',
  8: '中雨',
  9: '大雨',
  10: '暴雨',
  11: '大暴雨',
  12: '特大暴雨',
  13: '阵雪',
  14: '小雪',
  15: '中雪',
  16: '大雪',
  17: '暴雪',
  18: '雾',
  19: '冻雨',
  20: '沙尘暴',
  21: '小到中雨',
  22: '中到大雨',
  23: '大到暴雨',
  24: '暴雨到大暴雨',
  25: '大暴雨到特大暴雨',
  26: '小到中雪',
  27: '中到大雪',
  28: '大到暴雪',
  29: '浮尘',
  30: '扬沙',
  31: '强沙尘暴',
  32: '飑',
  33: '龙卷风',
  34: '吹雪',
  35: '轻雾',
  53: '霾',
  99: '未知',
};

export function weatherLabelForCode(code: number): string {
  return WEATHER_LABELS[code] ?? '未知';
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`小米天气响应缺少 ${label}`);
  }
  return value as JsonRecord;
}

function numberValue(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`小米天气响应中的 ${label} 不是有效数字`);
  }
  return parsed;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function measurementValue(container: JsonRecord, key: string): number {
  return numberValue(record(container[key], key).value, key);
}

function dateString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`小米天气响应中的 ${label} 不是有效时间`);
  }
  return value;
}

function parseHourlyWeather(root: JsonRecord): HourlyWeather[] {
  try {
    const forecastHourly = record(root.forecastHourly, 'forecastHourly');
    const weather = record(forecastHourly.weather, 'forecastHourly.weather');
    if (numberValue(weather.status, 'forecastHourly.weather.status') !== 0) {
      return [];
    }
    const publishedAt = dateString(
      weather.pubTime,
      'forecastHourly.weather.pubTime',
    );
    if (!Array.isArray(weather.value) || weather.value.length === 0) return [];
    const first = Date.parse(publishedAt);
    return weather.value.map((value, index) => {
      const weatherCode = numberValue(
        value,
        `forecastHourly.weather.value[${index}]`,
      );
      return {
        at: new Date(first + index * HOUR_MILLISECONDS).toISOString(),
        weatherCode,
        weatherLabel: weatherLabelForCode(weatherCode),
      };
    });
  } catch {
    return [];
  }
}

export function xiaomiWeatherUrl(): URL {
  const url = new URL(XIAOMI_WEATHER_ENDPOINT);
  url.searchParams.set('latitude', String(JIANGYIN_WEATHER_LOCATION.latitude));
  url.searchParams.set(
    'longitude',
    String(JIANGYIN_WEATHER_LOCATION.longitude),
  );
  url.searchParams.set('isLocated', 'true');
  url.searchParams.set('locationKey', JIANGYIN_WEATHER_LOCATION.locationKey);
  url.searchParams.set('days', '5');
  url.searchParams.set('appKey', XIAOMI_WEATHER_APP_KEY);
  url.searchParams.set('sign', XIAOMI_WEATHER_SIGN);
  url.searchParams.set('isGlobal', 'false');
  url.searchParams.set('locale', 'zh_cn');
  return url;
}

export function parseXiaomiWeather(input: unknown): WeatherSnapshot {
  const root = record(input, '根对象');
  const current = record(root.current, 'current');
  const weatherCode = numberValue(current.weather, 'current.weather');
  const forecastDaily = record(root.forecastDaily, 'forecastDaily');
  const dailyTemperature = record(
    forecastDaily.temperature,
    'forecastDaily.temperature',
  );
  const today = Array.isArray(dailyTemperature.value)
    ? dailyTemperature.value[0]
    : undefined;
  const todayTemperature = today
    ? record(today, 'forecastDaily.temperature.value[0]')
    : null;
  const aqi = root.aqi ? record(root.aqi, 'aqi') : null;

  const publishedAt = dateString(current.pubTime, 'current.pubTime');

  return {
    location: JIANGYIN_WEATHER_LOCATION,
    weatherCode,
    weatherLabel: weatherLabelForCode(weatherCode),
    temperature: measurementValue(current, 'temperature'),
    feelsLike: measurementValue(current, 'feelsLike'),
    humidity: measurementValue(current, 'humidity'),
    windSpeed: measurementValue(record(current.wind, 'wind'), 'speed'),
    aqi: optionalNumber(aqi?.aqi),
    high: optionalNumber(todayTemperature?.from),
    low: optionalNumber(todayTemperature?.to),
    publishedAt,
    hourly: parseHourlyWeather(root),
  };
}

export function weatherAtTime(
  snapshot: WeatherSnapshot,
  departureTime: Date,
): WeatherAtTime {
  const departure = departureTime.getTime();
  const published = Date.parse(snapshot.publishedAt);
  if (!Number.isFinite(departure) || !Number.isFinite(published)) {
    return { status: 'unavailable', reason: 'outside-forecast' };
  }

  const hourly = snapshot.hourly
    .map((entry) => ({ entry, time: Date.parse(entry.at) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => left.time - right.time);
  const currentStart = startOfCampusHour(new Date(published));
  const currentEnd = hourly[0]?.time ?? currentStart + HOUR_MILLISECONDS;
  if (departure >= currentStart && departure < currentEnd) {
    return {
      status: 'matched',
      source: 'current',
      at: snapshot.publishedAt,
      weatherCode: snapshot.weatherCode,
      weatherLabel: snapshot.weatherLabel,
    };
  }

  const match = hourly.find(
    ({ time }) => departure >= time && departure < time + HOUR_MILLISECONDS,
  );
  return match
    ? {
        status: 'matched',
        source: 'hourly',
        at: match.entry.at,
        weatherCode: match.entry.weatherCode,
        weatherLabel: match.entry.weatherLabel,
      }
    : { status: 'unavailable', reason: 'outside-forecast' };
}
