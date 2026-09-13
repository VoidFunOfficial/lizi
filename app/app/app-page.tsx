'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import Home from '../map-workspace';
import { AppUpdates } from './updates/app-updates';

type SplashPhase = 'visible' | 'leaving' | 'hidden';

export default function AppPage() {
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('visible');

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const leaveTimer = window.setTimeout(
      () => setSplashPhase('leaving'),
      reduceMotion ? 80 : 720,
    );
    const hideTimer = window.setTimeout(
      () => setSplashPhase('hidden'),
      reduceMotion ? 160 : 980,
    );

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      <AppUpdates>
        <Home initialMode="navigate" appView />
      </AppUpdates>
      {splashPhase !== 'hidden' && (
        <output
          className={`app-loading-screen ${splashPhase === 'leaving' ? 'is-leaving' : ''}`}
          aria-live="polite"
          aria-label="正在载入校园导航"
        >
          <div className="app-loading-content">
            <div className="app-loading-mark">
              <Image
                className="app-loading-logo app-loading-logo-base"
                src="/icon-sc-transparent.png"
                alt="南京理工大学校徽"
                width={196}
                height={196}
                priority
                draggable={false}
              />
              <span className="app-loading-fill" aria-hidden="true">
                <Image
                  className="app-loading-logo"
                  src="/icon-sc-transparent.png"
                  alt=""
                  width={196}
                  height={196}
                  priority
                  draggable={false}
                />
              </span>
            </div>
          </div>
        </output>
      )}
    </>
  );
}
