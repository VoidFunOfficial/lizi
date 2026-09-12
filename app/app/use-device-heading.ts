'use client';

import { useEffect, useState } from 'react';
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import { smoothHeading, type HeadingReading } from '@/lib/device-heading';

const native = registerPlugin<{
  start(): Promise<void>;
  stop(): Promise<void>;
  setLocation(location: { latitude: number; longitude: number }): Promise<void>;
  addListener(
    event: 'heading',
    listener: (reading: HeadingReading) => void,
  ): Promise<PluginListenerHandle>;
}>('Heading');

// Serialize native lifecycle calls, including Strict Mode setup/cleanup races.
let lifecycle = Promise.resolve();

export function useDeviceHeading(
  enabled: boolean,
  location: { latitude: number; longitude: number } | null,
) {
  const [reading, setReading] = useState<HeadingReading | null>(null);
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let listener: PluginListenerHandle | undefined;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous: number | null = null;
    let previousReference: boolean | undefined;
    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        previous = null;
        if (!cancelled) setReading({ status: 'stale' });
      }, 3_000);
    };
    lifecycle = lifecycle
      .then(async () => {
        if (cancelled) return;
        setReading({ status: 'initializing' });
        listener = await native.addListener('heading', (event) => {
          if (cancelled) return;
          armTimeout();
          const trueNorth = Number.isFinite(event.trueHeading);
          const degrees = trueNorth ? event.trueHeading : event.magneticHeading;
          if (
            (event.status !== 'ready' && event.status !== 'low') ||
            typeof degrees !== 'number' ||
            !Number.isFinite(degrees)
          ) {
            previous = null;
            setReading({ status: event.status });
            return;
          }
          if (previousReference !== trueNorth) previous = null;
          previousReference = trueNorth;
          previous = smoothHeading(previous, degrees);
          setReading({
            ...event,
            trueHeading: trueNorth ? previous : undefined,
            magneticHeading: trueNorth ? event.magneticHeading : previous,
          });
        });
        if (cancelled) return;
        await native.start();
        started = true;
        armTimeout();
      })
      .catch(() => {
        if (!cancelled) setReading({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      lifecycle = lifecycle.then(async () => {
        if (started) await native.stop().catch(() => undefined);
        await listener?.remove().catch(() => undefined);
        clearTimeout(timer);
      });
    };
  }, [enabled]);

  useEffect(() => {
    if (
      !enabled ||
      !Capacitor.isNativePlatform() ||
      latitude === undefined ||
      longitude === undefined
    )
      return;
    void native.setLocation({ latitude, longitude }).catch(() => undefined);
  }, [enabled, latitude, longitude]);

  return enabled ? reading : null;
}
