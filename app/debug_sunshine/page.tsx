'use client';

import { ArrowLeft, Building2, Clock3, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  createBuildingShadowPolygons,
  solarPositionAt,
} from '@/lib/campus-sunlight';
import { formatCampusDateTime, parseCampusDateTime } from '@/lib/campus-time';
import { MAP_HEIGHT, MAP_WIDTH, type MapPoint } from '@/lib/campus-model';
import { REFINED_GUIDE_IMAGE } from '@/lib/njust-jiangyin-reference';
import type { SolarBuilding } from '@/lib/campus-model';
import { CAMPUS_MAP_STORAGE_KEY, parseCampusMap } from '@/lib/campus-document';
import { migrateToCurrentBasemap } from '@/lib/campus-basemap-migration';

import styles from './page.module.css';

const DEFAULT_MINUTES = 12 * 60;

function timeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function pointsAttribute(points: readonly MapPoint[]): string {
  return points
    .map((point) => `${point.x * MAP_WIDTH},${point.y * MAP_HEIGHT}`)
    .join(' ');
}

function compassLabel(azimuth: number): string {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return directions[
    ((Math.round(azimuth / 45) % directions.length) + directions.length) %
      directions.length
  ];
}

function shadowLengthLabel(heightMeters: number, elevationDegrees: number) {
  if (elevationDegrees <= 0) return '—';
  const meters = heightMeters / Math.tan((elevationDegrees * Math.PI) / 180);
  return meters >= 1_000
    ? `${(meters / 1_000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export default function DebugSunshinePage() {
  const [buildings, setBuildings] = useState<SolarBuilding[]>([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    const sync = () => {
      try {
        const saved = window.localStorage.getItem(CAMPUS_MAP_STORAGE_KEY);
        setBuildings(
          saved
            ? (migrateToCurrentBasemap(parseCampusMap(saved)).solarBuildings ??
                [])
            : [],
        );
        setLoadError('');
      } catch {
        setLoadError('无法读取已保存的建筑，请返回地图编辑器检查数据');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CAMPUS_MAP_STORAGE_KEY) sync();
    };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
    };
  }, []);
  const highestBuilding = Math.max(
    0,
    ...buildings.map((building) => building.heightMeters),
  );
  const [date, setDate] = useState(() => formatCampusDateTime().slice(0, 10));
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const selectedTime = timeLabel(minutes);
  const instant = useMemo(
    () => parseCampusDateTime(`${date}T${selectedTime}`),
    [date, selectedTime],
  );
  const position = useMemo(
    () => (instant ? solarPositionAt(instant) : null),
    [instant],
  );
  const isDaylight = Boolean(position && position.elevationDegrees > 0);
  const shadows = useMemo(
    () =>
      position && position.elevationDegrees > 0
        ? createBuildingShadowPolygons(position, buildings)
        : [],
    [position, buildings],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.mark} aria-hidden="true">
            <Sun />
          </span>
          <div>
            <span className={styles.eyebrow}>DEBUG SUNSHINE</span>
            <h1>晴天建筑阴影模拟</h1>
          </div>
        </div>
        <Link className={styles.backLink} href="/editor">
          <ArrowLeft />
          <span>返回导航</span>
        </Link>
      </header>

      <section className={styles.mapPanel} aria-label="校园晴天阴影预览">
        <div className={styles.mapStatus}>
          <span className={styles.statusIcon} aria-hidden="true">
            {isDaylight ? <Sun /> : <Moon />}
          </span>
          <div>
            <strong>
              {date} · {selectedTime}
            </strong>
            <span>
              {isDaylight
                ? '强制晴天 · 建筑投影已启用'
                : '强制晴天 · 太阳位于地平线下'}
            </span>
          </div>
        </div>

        <svg
          className={styles.map}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          aria-label={
            position
              ? `${date} ${selectedTime} 晴天阴影，太阳高度 ${position.elevationDegrees.toFixed(1)} 度，方位 ${position.azimuthDegrees.toFixed(1)} 度`
              : '晴天阴影时间无效'
          }
        >
          <image
            href={`/${REFINED_GUIDE_IMAGE}`}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            preserveAspectRatio="none"
          />
          <g className={styles.shadows} aria-hidden="true">
            {shadows.map((shadow) => (
              <polygon
                key={shadow.buildingId}
                points={pointsAttribute(shadow.boundary)}
              />
            ))}
          </g>
          <g className={styles.buildings} aria-hidden="true">
            {buildings.map((building) => (
              <polygon
                key={building.id}
                points={pointsAttribute(building.footprint)}
              />
            ))}
          </g>
        </svg>

        <div className={styles.legend} aria-label="建筑模型图例">
          <span>
            <i className={styles.shadowSwatch} /> 投影阴影
          </span>
          <span>
            <i className={styles.buildingSwatch} /> {buildings.length}{' '}
            栋自定义建筑
          </span>
        </div>
      </section>

      <section className={styles.controls} aria-label="晴天模拟控制">
        <div className={styles.timeControl}>
          <div className={styles.controlHeading}>
            <span>
              <Clock3 />
              上海时间
            </span>
            <time dateTime={instant?.toISOString()}>{selectedTime}</time>
          </div>
          <input
            className={styles.slider}
            type="range"
            min="0"
            max="1439"
            step="1"
            value={minutes}
            aria-label="模拟时间"
            aria-valuetext={`${selectedTime}，上海时间`}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
          <div className={styles.ticks} aria-hidden="true">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        <label className={styles.dateControl}>
          <span>模拟日期</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <dl className={styles.metrics}>
          <div>
            <dt>太阳高度</dt>
            <dd>{position?.elevationDegrees.toFixed(1) ?? '—'}°</dd>
          </div>
          <div>
            <dt>太阳方位</dt>
            <dd>
              {position
                ? `${position.azimuthDegrees.toFixed(1)}° ${compassLabel(position.azimuthDegrees)}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>最高建筑</dt>
            <dd>{highestBuilding ? `${highestBuilding} m` : '—'}</dd>
          </div>
          <div>
            <dt>最高建筑阴影</dt>
            <dd>
              {highestBuilding
                ? shadowLengthLabel(
                    highestBuilding,
                    position?.elevationDegrees ?? -1,
                  )
                : '—'}
            </dd>
          </div>
        </dl>

        <div className={styles.modelNote}>
          <Building2 />
          <span>
            {loadError ||
              (buildings.length
                ? '使用地图编辑器中保存的矩形与建筑高度'
                : '尚未添加阴影建筑，旧建筑预设已清空')}{' '}
            · <Link href="/editor">添加或编辑阴影</Link>
          </span>
        </div>
      </section>
    </main>
  );
}
