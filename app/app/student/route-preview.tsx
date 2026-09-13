'use client';

import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { timeLabel } from '@/lib/student/calendar';
import {
  routePreviewPoint,
  type PreviewLeg,
} from '@/lib/student/route-preview';

export function useRoutePreview(visible: boolean) {
  const [session, setSession] = useState<{
    legs: PreviewLeg[];
    date: string;
    wholeDay: boolean;
    index: number;
    progress: number;
    playing: boolean;
  } | null>(null);
  useEffect(() => {
    if (!session?.playing || !visible) return;
    let last = performance.now();
    let frame: number;
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const elapsed = Math.min(now - last, 100);
      last = now;
      if (document.hidden) return;
      setSession((current) => {
        if (!current?.playing) return current;
        const duration = current.legs[current.index].route ? 5000 : 1800;
        const progress = current.progress + elapsed / duration;
        if (progress < 1.2) return { ...current, progress };
        if (current.index + 1 < current.legs.length)
          return { ...current, index: current.index + 1, progress: 0 };
        return { ...current, progress: 1, playing: false };
      });
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [session?.playing, visible]);
  const leg = session?.legs[session.index];
  const point = leg?.route
    ? routePreviewPoint(leg.route.geometry, session!.progress)
    : null;
  return {
    session,
    leg,
    point,
    open: (legs: PreviewLeg[], date: string, wholeDay: boolean) => {
      if (!legs.length) return;
      setSession({
        legs,
        date,
        wholeDay,
        index: 0,
        progress: 0,
        playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    },
    close: () => setSession(null),
    step: (index: number) =>
      setSession((current) =>
        current ? { ...current, index, progress: 0 } : null,
      ),
    toggle: () =>
      setSession((current) =>
        current
          ? {
              ...current,
              playing: !current.playing,
              ...(current.index === current.legs.length - 1 &&
              current.progress >= 1
                ? { index: 0, progress: 0 }
                : {}),
            }
          : null,
      ),
    replay: () =>
      setSession((current) =>
        current ? { ...current, index: 0, progress: 0, playing: true } : null,
      ),
  };
}

export function RoutePreviewControls({
  preview,
  onClose,
}: {
  preview: ReturnType<typeof useRoutePreview>;
  onClose: () => void;
}) {
  const { session, leg } = preview;
  if (!session || !leg) return null;
  const distance = session.legs.reduce(
    (sum, item) => sum + (item.route?.metrics.distanceMeters ?? 0),
    0,
  );
  const missing = session.legs.filter(
    (item) =>
      !item.route &&
      item.needsRoute !== false &&
      item.message !== '同一地点，无需步行',
  ).length;
  return (
    <section
      className="route-preview-panel"
      aria-label={session.wholeDay ? '全天路程预览' : '路线预览'}
    >
      <div className="route-preview-heading">
        <strong>{session.wholeDay ? '全天路程预览' : '路线预览'}</strong>
        <button onClick={onClose} aria-label="关闭预览">
          <X size={20} />
        </button>
      </div>
      <small>
        {session.date} · {Math.round(distance)} 米
        {missing ? ` · ${missing} 段路线待完善` : ''}
      </small>
      <div className="route-preview-leg" aria-live="polite">
        {leg.stopTitle && <small>{leg.stopTitle}</small>}
        <strong>
          {leg.from} → {leg.to}
        </strong>
        <span>
          {timeLabel(leg.departure)}
          {leg.route ? ' 出发' : ''} · {timeLabel(leg.arrival)}
          {leg.route ? ' 到达' : ''}
          {!leg.route ? ` · ${leg.message}` : ''}
        </span>
      </div>
      <progress
        aria-label="当天预览进度"
        max={session.legs.length}
        value={session.index + Math.min(1, session.progress)}
      />
      <div className="route-preview-actions">
        <button
          aria-label="上一段"
          disabled={session.index === 0}
          onClick={() => preview.step(session.index - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <button onClick={preview.toggle}>
          {session.playing ? <Pause size={17} /> : <Play size={17} />}
          {session.playing ? '暂停' : '播放'}
        </button>
        <span>
          {session.index + 1} / {session.legs.length}
        </span>
        <button
          aria-label="下一段"
          disabled={session.index === session.legs.length - 1}
          onClick={() => preview.step(session.index + 1)}
        >
          <ChevronRight size={20} />
        </button>
        <button aria-label="重播全部路线" onClick={preview.replay}>
          <RotateCcw size={18} />
        </button>
      </div>
    </section>
  );
}
