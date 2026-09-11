import assert from 'node:assert/strict';
import test from 'node:test';

import {
  JIANGYIN_WEATHER_LOCATION,
  parseXiaomiWeather,
  weatherAtTime,
  xiaomiWeatherUrl,
} from '../lib/xiaomi-weather.ts';

void test('Xiaomi weather URL reuses the established campus center', () => {
  const url = xiaomiWeatherUrl();

  assert.equal(
    url.searchParams.get('latitude'),
    String((31.90918 + 31.90105) / 2),
  );
  assert.equal(
    url.searchParams.get('longitude'),
    String((120.16115 + 120.1459) / 2),
  );
  assert.equal(url.searchParams.get('locationKey'), 'weathercn:101190202');
  assert.equal(url.searchParams.get('isLocated'), 'true');
  assert.equal(JIANGYIN_WEATHER_LOCATION.name, '江阴校区');
});

void test('Xiaomi weather response is reduced to the header snapshot', () => {
  const snapshot = parseXiaomiWeather({
    current: {
      feelsLike: { unit: '℃', value: '33' },
      humidity: { unit: '%', value: '93' },
      pubTime: '2026-09-01T11:44:10+08:00',
      temperature: { unit: '℃', value: '28' },
      weather: '0',
      wind: { speed: { unit: 'km/h', value: '6.0' } },
    },
    forecastDaily: {
      temperature: { value: [{ from: '30', to: '25' }] },
    },
    aqi: { aqi: '25' },
  });

  assert.deepEqual(
    {
      weatherCode: snapshot.weatherCode,
      weatherLabel: snapshot.weatherLabel,
      temperature: snapshot.temperature,
      feelsLike: snapshot.feelsLike,
      humidity: snapshot.humidity,
      windSpeed: snapshot.windSpeed,
      aqi: snapshot.aqi,
      high: snapshot.high,
      low: snapshot.low,
      publishedAt: snapshot.publishedAt,
    },
    {
      weatherCode: 0,
      weatherLabel: '晴',
      temperature: 28,
      feelsLike: 33,
      humidity: 93,
      windSpeed: 6,
      aqi: 25,
      high: 30,
      low: 25,
      publishedAt: '2026-09-01T11:44:10+08:00',
    },
  );
});

void test('invalid Xiaomi weather payload fails closed', () => {
  assert.throws(
    () => parseXiaomiWeather({ current: {}, forecastDaily: {} }),
    /current\.weather/,
  );
});

void test('future departures use Xiaomi hourly weather with exact hour boundaries', () => {
  const snapshot = parseXiaomiWeather({
    current: {
      feelsLike: { value: '31' },
      humidity: { value: '75' },
      pubTime: '2026-09-03T11:44:10+08:00',
      temperature: { value: '29' },
      weather: '1',
      wind: { speed: { value: '5' } },
    },
    forecastDaily: { temperature: { value: [] } },
    forecastHourly: {
      weather: {
        status: '0',
        pubTime: '2026-09-03T12:00:00+08:00',
        value: ['0', '7'],
      },
    },
  });

  assert.deepEqual(snapshot.hourly, [
    {
      at: '2026-09-03T04:00:00.000Z',
      weatherCode: 0,
      weatherLabel: '晴',
    },
    {
      at: '2026-09-03T05:00:00.000Z',
      weatherCode: 7,
      weatherLabel: '小雨',
    },
  ]);
  assert.deepEqual(
    weatherAtTime(snapshot, new Date('2026-09-03T11:59:59+08:00')),
    {
      status: 'matched',
      source: 'current',
      at: '2026-09-03T11:44:10+08:00',
      weatherCode: 1,
      weatherLabel: '多云',
    },
  );
  assert.deepEqual(
    weatherAtTime(snapshot, new Date('2026-09-03T12:00:00+08:00')),
    {
      status: 'matched',
      source: 'hourly',
      at: '2026-09-03T04:00:00.000Z',
      weatherCode: 0,
      weatherLabel: '晴',
    },
  );
  assert.deepEqual(
    weatherAtTime(snapshot, new Date('2026-09-03T14:00:00+08:00')),
    { status: 'unavailable', reason: 'outside-forecast' },
  );
});

void test('malformed hourly data cannot activate the sunlight model', () => {
  const snapshot = parseXiaomiWeather({
    current: {
      feelsLike: { value: '31' },
      humidity: { value: '75' },
      pubTime: '2026-09-03T11:44:10+08:00',
      temperature: { value: '29' },
      weather: '0',
      wind: { speed: { value: '5' } },
    },
    forecastDaily: { temperature: { value: [] } },
    forecastHourly: {
      weather: { status: '0', pubTime: 'invalid', value: ['0'] },
    },
  });

  assert.deepEqual(snapshot.hourly, []);
  assert.deepEqual(
    weatherAtTime(snapshot, new Date('2026-09-03T13:00:00+08:00')),
    { status: 'unavailable', reason: 'outside-forecast' },
  );
});
