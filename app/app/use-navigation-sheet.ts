'use client';

import { useEffect, useRef } from 'react';
import {
  rubberbandSheet,
  sheetReleaseTarget,
  stepSheetSpring,
} from '@/lib/sheet-motion';

export function useNavigationSheet(
  open: boolean,
  enabled: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const driver = useRef<((open: boolean) => void) | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const handle = handleRef.current;
    if (!enabled || !panel || !handle) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let y = 0;
    let velocity = 0;
    let targetOpen = true;
    let frame = 0;
    let lastFrame = 0;
    let gesture: {
      id: number;
      startY: number;
      origin: number;
      moved: boolean;
      samples: { y: number; time: number }[];
    } | null = null;
    let suppressClick = false;
    const distance = () =>
      Math.max(
        panel.offsetHeight + 32,
        window.innerHeight - panel.getBoundingClientRect().top + y + 24,
      );
    const paint = () => {
      panel.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const animate = () => {
      stop();
      panel.style.visibility = 'visible';
      const tick = (time: number) => {
        const target = targetOpen ? 0 : distance();
        const dt = Math.min((time - lastFrame) / 1000 || 1 / 60, 0.064);
        lastFrame = time;
        const next = stepSheetSpring(y, velocity, target, dt);
        y = reduced.matches ? target : next.position;
        velocity = reduced.matches ? 0 : next.velocity;
        const settled = Math.abs(y - target) < 0.5 && Math.abs(velocity) < 5;
        if (settled) {
          y = target;
          velocity = 0;
        }
        paint();
        if (!settled) frame = requestAnimationFrame(tick);
        else {
          frame = 0;
          panel.style.willChange = '';
          if (!targetOpen) panel.style.visibility = 'hidden';
        }
      };
      lastFrame = performance.now();
      panel.style.willChange = 'transform';
      frame = requestAnimationFrame(tick);
    };
    driver.current = (nextOpen) => {
      targetOpen = nextOpen;
      if (!gesture) animate();
    };
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      stop();
      // y is the last painted presentation value, including an interrupted spring.
      gesture = {
        id: event.pointerId,
        startY: event.clientY,
        origin: y,
        moved: false,
        samples: [{ y: event.clientY, time: event.timeStamp }],
      };
      if (!targetOpen) {
        targetOpen = true;
        onOpenChange(true);
      }
      suppressClick = false;
      handle.setPointerCapture(event.pointerId);
      panel.style.willChange = 'transform';
    };
    const move = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = event.clientY - gesture.startY;
      gesture.moved ||= Math.abs(delta) >= 10;
      if (!gesture.moved) return;
      gesture.samples = [
        ...gesture.samples.filter(
          (sample) => event.timeStamp - sample.time < 100,
        ),
        { y: event.clientY, time: event.timeStamp },
      ];
      y = rubberbandSheet(gesture.origin + delta, distance());
      if (!reduced.matches) paint();
    };
    const end = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const { moved, samples } = gesture;
      gesture = null;
      suppressClick = moved && event.type === 'pointerup';
      const first = samples.find(
        (sample) => event.timeStamp - sample.time < 120,
      );
      velocity =
        moved && first && event.timeStamp > first.time
          ? ((event.clientY - first.y) / (event.timeStamp - first.time)) * 1000
          : 0;
      const cancelled = event.type !== 'pointerup';
      targetOpen =
        cancelled || !moved || !sheetReleaseTarget(y, velocity, distance());
      if (cancelled) velocity = 0;
      if (handle.hasPointerCapture(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      animate();
      onOpenChange(targetOpen);
    };
    const click = (event: MouseEvent) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
        return;
      }
      onOpenChange(false);
    };
    const resize = () => {
      if (!gesture) animate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);
    handle.addEventListener('click', click);
    window.addEventListener('resize', resize);
    return () => {
      stop();
      observer.disconnect();
      driver.current = null;
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      handle.removeEventListener('lostpointercapture', end);
      handle.removeEventListener('click', click);
      window.removeEventListener('resize', resize);
      panel.style.transform = '';
      panel.style.visibility = '';
      panel.style.willChange = '';
    };
  }, [enabled, onOpenChange]);

  useEffect(() => {
    driver.current?.(open);
  }, [open, enabled]);
  return { panelRef, handleRef };
}
