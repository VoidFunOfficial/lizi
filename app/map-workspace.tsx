'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import {
  Accessibility,
  ArrowRight,
  Building2,
  ChevronDown,
  CircleDot,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Compass,
  Crosshair,
  Download,
  Layers3,
  LocateFixed,
  MapPin,
  MousePointer2,
  Navigation,
  Pentagon,
  Route,
  Save,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  SquareDashed,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Waypoints,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  useCallback,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShadowInspector } from './shadow-inspector';
import StudentHub, { type StudentTab } from './app/student/student-hub';
import {
  RoutePreviewControls,
  useRoutePreview,
} from './app/student/route-preview';
import { useNavigationSheet } from './app/use-navigation-sheet';
import { useDeviceHeading } from './app/use-device-heading';
import { headingLabel, headingOnMap } from '@/lib/device-heading';
import type { PlanLeg } from '@/lib/student/planner';
import { timeLabel } from '@/lib/student/calendar';
import { dailyPreviewLegs } from '@/lib/student/route-preview';
import georectification from '@/data/campus-guide-georectification.json';
import {
  createFeatureId,
  deleteFeature,
  insertSnappedNode,
  mapPixelRadiusForScreenPixels,
  nearestLink,
  nearestNode,
  type FeatureSelection,
  type SnapExclusions,
} from '@/lib/campus-editor';
import {
  CAMPUS_MAP_STORAGE_KEY,
  parseCampusMap,
  serializeCampusMap,
} from '@/lib/campus-document';
import {
  createDefaultCampusMap,
  isReferenceOnlyPlaceholder,
  isPreviousBundledCampusMap,
  sameCampusMapContent,
} from '@/lib/default-campus-map';
import {
  isCurrentBasemap,
  migrateToCurrentBasemap,
} from '@/lib/campus-basemap-migration';
import { compileCampusMap, type CampusNavigator } from '@/lib/campus-navigator';
import { formatCampusDateTime, parseCampusDateTime } from '@/lib/campus-time';
import { createCampusSunlightContext } from '@/lib/campus-sunlight';
import {
  buildMapCalibration,
  type BuiltMapCalibration,
} from '@/lib/map-calibration';
import {
  JIANGYIN_BAIDU_VISUAL_REFERENCE_URL,
  REFINED_GUIDE_REVISION,
  applyJiangyinReference,
} from '@/lib/njust-jiangyin-reference';
import { rectangleFootprint } from '@/lib/njust-solar-buildings';
import {
  parseXiaomiWeather,
  weatherAtTime,
  xiaomiWeatherUrl,
  type WeatherSnapshot,
} from '@/lib/xiaomi-weather';
import {
  DEFAULT_ACCESS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVEL,
  MAP_HEIGHT,
  MAP_WIDTH,
  accessForKind,
  environmentForKind,
  pointDistancePixels,
  pointInPolygon,
  type AccessRule,
  type CalibrationAnchor,
  type CampusMapDocument,
  type CampusRoute,
  type MapPoint,
  type MapCalibration,
  type RoutePoint,
  type RouteProfile,
  type SunlightInactiveReason,
  type TravelEnvironment,
  type TraversalKind,
  type TraversalLink,
  type TraversalNode,
  type WalkableArea,
} from '@/lib/campus-model';

type AppMode = 'annotate' | 'navigate';
type DrawingTool =
  | 'path'
  | 'curve'
  | 'area'
  | 'obstacle'
  | 'shadow'
  | 'building'
  | 'vertical'
  | 'place'
  | 'calibration'
  | 'select';
type GeoPosition = MapPoint & {
  accuracy: number;
  latitude: number;
  longitude: number;
};
type RouteAlternative = { profile: RouteProfile; route: CampusRoute | null };
type LocationCoordinates = {
  accuracy: number;
  latitude: number;
  longitude: number;
};
type LocationWatch =
  | { platform: 'native'; id: string }
  | { platform: 'web'; id: number };

const STORAGE_KEY = CAMPUS_MAP_STORAGE_KEY;
const REFINED_STORAGE_KEY = 'njust-campus-map-v2-guide-refined';
const VECTOR_STORAGE_KEY = 'njust-campus-map-v2-precision';
const PREVIOUS_STORAGE_KEY = 'njust-campus-map-v2';
const LEGACY_STORAGE_KEY = 'njust-map-road-graph-v1';
const HISTORY_LIMIT = 60;
const SNAP_RADIUS_SCREEN_PIXELS = 6;
const NO_SNAP_THRESHOLD = -1;
const MIN_LINK_LENGTH_MAP_PIXELS = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const APP_NAVIGATION_ZOOM = 4;
const LOCATION_UPDATE_INTERVAL_MS = 3_000;
const ROUTE_PROFILES: Array<{
  id: RouteProfile;
  name: string;
  detail: string;
}> = [
  { id: 'fastest', name: '最快', detail: '只看通行时间' },
  { id: 'balanced', name: '均衡', detail: '兼顾距离与实时日晒' },
  { id: 'cool', name: '少晒', detail: '晴天优先建筑阴影' },
  { id: 'rain', name: '避雨', detail: '偏好室内和连廊' },
  { id: 'accessible', name: '无障碍', detail: '排除楼梯与障碍' },
];
const TOOL_ITEMS: Array<{
  id: DrawingTool;
  label: string;
  icon: typeof Route;
  hint: string;
}> = [
  {
    id: 'path',
    label: '直线路径',
    icon: Route,
    hint: '连续点击绘制；靠近路网自动接入，按住 Option / Alt 精确落点',
  },
  {
    id: 'curve',
    label: '曲线路径',
    icon: Waypoints,
    hint: '用多个控制点贴合弯路',
  },
  {
    id: 'area',
    label: '通行面',
    icon: Pentagon,
    hint: '框出运动场等自由穿行区域',
  },
  {
    id: 'obstacle',
    label: '障碍物',
    icon: SquareDashed,
    hint: '在通行面内挖出不可穿行区域',
  },
  {
    id: 'shadow',
    label: '添加阴影',
    icon: Sun,
    hint: '点击矩形两个对角，设置建筑高度，再保存阴影',
  },
  {
    id: 'building',
    label: '楼内穿行',
    icon: Building2,
    hint: '标注可通行且凉快的教学楼通道',
  },
  {
    id: 'vertical',
    label: '跨层连接',
    icon: Layers3,
    hint: '放置楼梯、电梯或坡道',
  },
  {
    id: 'place',
    label: '地点',
    icon: MapPin,
    hint: '添加可搜索的导航地点',
  },
  {
    id: 'calibration',
    label: '地图校准',
    icon: Crosshair,
    hint: '配对原图控制点与真实 WGS-84 坐标',
  },
  {
    id: 'select',
    label: '选择',
    icon: MousePointer2,
    hint: '检查或编辑已有要素',
  },
];

type WeatherState =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: WeatherSnapshot }
  | { status: 'error' };

function WeatherIcon({ code }: { code: number }) {
  if (code === 0) return <Sun />;
  if ([1, 2].includes(code)) return <Cloud />;
  if ([4, 5, 32, 33].includes(code)) return <CloudLightning />;
  if ([6, 13, 14, 15, 16, 17, 26, 27, 28, 34].includes(code)) {
    return <CloudSnow />;
  }
  if ([18, 29, 35, 53].includes(code)) return <CloudFog />;
  if ([3, 7, 8, 9, 10, 11, 12, 19, 21, 22, 23, 24, 25].includes(code)) {
    return <CloudRain />;
  }
  return <Cloud />;
}

function useWeatherReport() {
  const [state, setState] = useState<WeatherState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        let snapshot: WeatherSnapshot;
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url: xiaomiWeatherUrl().toString(),
            headers: { Accept: 'application/json' },
            connectTimeout: 8_000,
            readTimeout: 8_000,
            responseType: 'json',
          });
          if (response.status < 200 || response.status >= 300) {
            throw new Error(`天气接口返回 ${response.status}`);
          }
          const payload =
            typeof response.data === 'string'
              ? JSON.parse(response.data)
              : response.data;
          snapshot = parseXiaomiWeather(payload);
        } else {
          const response = await fetch('/api/weather', {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`天气接口返回 ${response.status}`);
          snapshot = (await response.json()) as WeatherSnapshot;
        }
        if (
          typeof snapshot.weatherLabel !== 'string' ||
          !Number.isFinite(snapshot.temperature) ||
          !Number.isFinite(snapshot.weatherCode) ||
          Number.isNaN(Date.parse(snapshot.publishedAt)) ||
          !Array.isArray(snapshot.hourly) ||
          snapshot.hourly.some(
            (entry) =>
              !entry ||
              !Number.isFinite(entry.weatherCode) ||
              Number.isNaN(Date.parse(entry.at)),
          )
        ) {
          throw new TypeError('天气接口响应格式不正确');
        }
        if (active) setState({ status: 'ready', snapshot });
      } catch (error) {
        if (
          active &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setState({ status: 'error' });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  return {
    state,
    retry: () => {
      setState({ status: 'loading' });
      setAttempt((value) => value + 1);
    },
  };
}

function WeatherWidget({
  state,
  onRetry,
}: {
  state: WeatherState;
  onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <output className="weather-widget is-loading">
        <Cloud />
        <div className="weather-copy">
          <strong>天气加载中</strong>
          <small>江阴校区</small>
        </div>
      </output>
    );
  }

  if (state.status === 'error') {
    return (
      <button
        type="button"
        className="weather-widget weather-retry"
        onClick={onRetry}
        title="重新获取小米天气"
      >
        <RefreshCw />
        <div className="weather-copy">
          <strong>天气暂不可用</strong>
          <small>点击重试</small>
        </div>
      </button>
    );
  }

  const { snapshot } = state;
  const updatedAt = new Date(snapshot.publishedAt).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dailyRange =
    snapshot.high === undefined || snapshot.low === undefined
      ? ''
      : `今日 ${Math.round(snapshot.high)}° / ${Math.round(snapshot.low)}° · `;
  const aqi = snapshot.aqi === undefined ? '' : ` · AQI ${snapshot.aqi}`;

  return (
    <div
      className="weather-widget"
      aria-live="polite"
      aria-label={`${snapshot.location.name}天气：${snapshot.weatherLabel}，${Math.round(snapshot.temperature)}摄氏度，体感${Math.round(snapshot.feelsLike)}摄氏度，湿度${Math.round(snapshot.humidity)}%`}
      title={`${snapshot.location.name} · 小米天气\n${dailyRange}风速 ${snapshot.windSpeed} km/h${aqi}\n${updatedAt} 更新`}
    >
      <WeatherIcon code={snapshot.weatherCode} />
      <div className="weather-copy">
        <div className="weather-main">
          <strong>{Math.round(snapshot.temperature)}°</strong>
          <span>{snapshot.weatherLabel}</span>
        </div>
        <small>
          体感 {Math.round(snapshot.feelsLike)}° · 湿度{' '}
          {Math.round(snapshot.humidity)}%
        </small>
      </div>
    </div>
  );
}

function continuationSnapExclusions(nodeId: string): SnapExclusions {
  return { nodeIds: new Set([nodeId]) };
}

function pointsAttribute(points: MapPoint[]): string {
  return points
    .map((point) => `${point.x * MAP_WIDTH},${point.y * MAP_HEIGHT}`)
    .join(' ');
}

function averagePoint(points: MapPoint[]): MapPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function geolocationErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '无法获取当前位置';
  const locationError = error as {
    code?: number | string;
    PERMISSION_DENIED?: number;
    POSITION_UNAVAILABLE?: number;
    TIMEOUT?: number;
  };
  if (
    locationError.code === locationError.PERMISSION_DENIED ||
    locationError.code === 'OS-PLUG-GLOC-0003'
  ) {
    return '定位权限被拒绝，请允许应用访问位置';
  }
  if (
    locationError.code === locationError.POSITION_UNAVAILABLE ||
    ['OS-PLUG-GLOC-0002', 'OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009'].includes(
      String(locationError.code),
    )
  ) {
    return '暂时无法获取设备位置，请确认系统定位已开启';
  }
  if (
    locationError.code === locationError.TIMEOUT ||
    locationError.code === 'OS-PLUG-GLOC-0010'
  ) {
    return '定位超时，请移到开阔区域后重试';
  }
  return '无法获取当前位置';
}

function geolocationPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const locationError = error as {
    code?: number | string;
    PERMISSION_DENIED?: number;
  };
  return (
    locationError.code === locationError.PERMISSION_DENIED ||
    locationError.code === 'OS-PLUG-GLOC-0003'
  );
}

function tryBuildCalibration(
  document: CampusMapDocument,
): BuiltMapCalibration | null {
  if (!document.map.calibration) return null;
  try {
    return buildMapCalibration(
      document.map.calibration,
      document.map.width,
      document.map.height,
    );
  } catch {
    return null;
  }
}

function calibrationStatusLabel(
  status: BuiltMapCalibration['quality']['status'],
): string {
  if (status === 'good') return '覆盖良好';
  if (status === 'usable') return '可用';
  if (status === 'poor-coverage') return '覆盖不足';
  return '需要复核';
}

function routeDistanceLabel(route: CampusRoute): string {
  if (route.metrics.distanceMeters !== undefined) {
    return route.metrics.distanceMeters >= 1000
      ? `${(route.metrics.distanceMeters / 1000).toFixed(2)} 公里`
      : `${Math.round(route.metrics.distanceMeters)} 米`;
  }
  return `${Math.round(route.metrics.distancePixels)} 地图像素`;
}

function routeTimeLabel(route: CampusRoute): string {
  return `约 ${Math.max(1, Math.round(route.metrics.estimatedSeconds / 60))} 分钟`;
}

function localDateTimeValue(): string {
  return formatCampusDateTime();
}

function appNoticeText(notice: string): string {
  if (
    /已接入最新校园标注|已从本地数据恢复|已按实时太阳位置|已计算其他路线条件|持续定位已开启/.test(
      notice,
    )
  )
    return '';
  if (/超出校准范围/.test(notice)) return '当前位置不在校区内';
  if (/地图校准/.test(notice)) return '暂时无法定位，请选择起点';
  if (/存储|迁移|JSON|自动保存/.test(notice))
    return '地图加载或保存失败，请稍后重试';
  return notice;
}

function sunlightInactiveLabel(reason: SunlightInactiveReason): string {
  if (reason === 'not-sunny') return '该时段非晴天，未启用日晒权重';
  if (reason === 'outside-forecast')
    return '所选时间无小时天气，未启用日晒权重';
  if (reason === 'sun-below-horizon') return '太阳位于地平线下，无直射日晒';
  if (reason === 'unsupported-basemap') return '当前底图不支持建筑阴影模型';
  return '天气暂不可用，未启用日晒权重';
}

function sunlightDistanceLabel(
  meters: number | undefined,
  pixels: number,
): string {
  return meters === undefined
    ? `${Math.round(pixels)} 地图像素`
    : `${Math.round(meters)} 米`;
}

function campusTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function splitRouteByLevel(
  points: RoutePoint[],
  levelId: string,
): RoutePoint[][] {
  const segments: RoutePoint[][] = [];
  let current: RoutePoint[] = [];
  for (const point of points) {
    if (point.levelId === levelId) current.push(point);
    else if (current.length > 0) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

function ScheduleFields({
  access,
  onChange,
}: {
  access: AccessRule;
  onChange: (access: AccessRule) => void;
}) {
  const fieldId = useId();
  const enabled = Boolean(access.schedule);
  const schedule = access.schedule ?? {
    days: [0, 1, 2, 3, 4, 5, 6],
    opens: '07:00',
    closes: '22:00',
  };
  return (
    <div className="schedule-fields">
      <label className="check-field">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onChange({
              ...access,
              schedule: event.target.checked ? schedule : undefined,
            })
          }
        />
        限定开放时间
      </label>
      {enabled && (
        <>
          <div className="day-picker" aria-label="开放星期">
            {'日一二三四五六'.split('').map((day, index) => (
              <button
                key={day}
                type="button"
                className={schedule.days.includes(index) ? 'is-active' : ''}
                onClick={() => {
                  const days = schedule.days.includes(index)
                    ? schedule.days.filter((value) => value !== index)
                    : [...schedule.days, index].sort((a, b) => a - b);
                  onChange({ ...access, schedule: { ...schedule, days } });
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="two-columns">
            <label className="field-label" htmlFor={`${fieldId}-opens`}>
              开放
              <Input
                id={`${fieldId}-opens`}
                type="time"
                value={schedule.opens}
                onChange={(event) =>
                  onChange({
                    ...access,
                    schedule: { ...schedule, opens: event.target.value },
                  })
                }
              />
            </label>
            <label className="field-label" htmlFor={`${fieldId}-closes`}>
              关闭
              <Input
                id={`${fieldId}-closes`}
                type="time"
                value={schedule.closes}
                onChange={(event) =>
                  onChange({
                    ...access,
                    schedule: { ...schedule, closes: event.target.value },
                  })
                }
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function AccessFields({
  access,
  onChange,
}: {
  access: AccessRule;
  onChange: (access: AccessRule) => void;
}) {
  return (
    <div className="inspector-stack">
      <label className="field-label">
        可通行人群
        <select
          className="select-field"
          value={access.audience}
          onChange={(event) =>
            onChange({
              ...access,
              audience: event.target.value as AccessRule['audience'],
            })
          }
        >
          <option value="public">所有人</option>
          <option value="campus">仅校内人员</option>
          <option value="restricted">禁止通行</option>
        </select>
      </label>
      <div className="two-columns checks">
        <label className="check-field">
          <input
            type="checkbox"
            checked={access.wheelchair}
            onChange={(event) =>
              onChange({ ...access, wheelchair: event.target.checked })
            }
          />
          轮椅可通行
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={access.temporarilyClosed}
            onChange={(event) =>
              onChange({ ...access, temporarilyClosed: event.target.checked })
            }
          />
          临时关闭
        </label>
      </div>
      <ScheduleFields access={access} onChange={onChange} />
    </div>
  );
}

function EnvironmentFields({
  environment,
  onChange,
}: {
  environment: TravelEnvironment;
  onChange: (environment: TravelEnvironment) => void;
}) {
  return (
    <div className="inspector-stack">
      <label className="field-label">
        环境
        <select
          className="select-field"
          value={environment.setting}
          onChange={(event) =>
            onChange({
              ...environment,
              setting: event.target.value as TravelEnvironment['setting'],
            })
          }
        >
          <option value="outdoor">室外</option>
          <option value="covered">有顶连廊</option>
          <option value="indoor">室内</option>
        </select>
      </label>
      <p className="helper-text">
        室外日晒由江阴天气、出发时间和指定建筑高度自动计算；旧遮阴值仅为导入兼容，不参与新导航。
      </p>
    </div>
  );
}

function NodeInspector({
  node,
  document,
  onChange,
}: {
  node: TraversalNode;
  document: CampusMapDocument;
  onChange: (document: CampusMapDocument) => void;
}) {
  const place = document.places.find((item) => item.nodeId === node.id);
  const derivedCoordinate = tryBuildCalibration(document)?.imageToWgs84(node);
  const updateNode = (patch: Partial<TraversalNode>) =>
    onChange({
      ...document,
      nodes: document.nodes.map((item) =>
        item.id === node.id ? { ...item, ...patch } : item,
      ),
    });
  const updatePlace = (name: string) => {
    const trimmed = name.trim();
    const places = place
      ? trimmed
        ? document.places.map((item) =>
            item.id === place.id ? { ...item, name } : item,
          )
        : document.places.filter((item) => item.id !== place.id)
      : trimmed
        ? [
            ...document.places,
            { id: createFeatureId('place'), name, nodeId: node.id },
          ]
        : document.places;
    onChange({ ...document, places });
  };
  return (
    <div className="inspector-stack">
      <p className="section-label">节点 / 地点</p>
      <label className="field-label" htmlFor={`place-${node.id}`}>
        地点名称
        <Input
          id={`place-${node.id}`}
          key={place?.id ?? node.id}
          defaultValue={place?.name ?? ''}
          placeholder="例如：图书馆北门"
          onBlur={(event) => updatePlace(event.target.value)}
        />
      </label>
      <label className="field-label">
        节点类型
        <select
          className="select-field"
          value={node.kind}
          onChange={(event) =>
            updateNode({ kind: event.target.value as TraversalNode['kind'] })
          }
        >
          <option value="junction">普通交汇点</option>
          <option value="portal">门户 / 出入口</option>
        </select>
      </label>
      <div className="coordinate-readout">
        <span>WGS-84 坐标</span>
        <strong>
          {derivedCoordinate
            ? `${derivedCoordinate.latitude.toFixed(7)}, ${derivedCoordinate.longitude.toFixed(7)}`
            : '尚未建立地图校准'}
        </strong>
      </div>
      <p className="helper-text">
        地点坐标由统一地图校准计算，避免每个导航节点各自保存不同坐标系的锚点。
      </p>
    </div>
  );
}

function CalibrationInspector({
  document,
  draft,
  built,
  onCommit,
  onApplyReference,
  onNotice,
}: {
  document: CampusMapDocument;
  draft: MapPoint | null;
  built: BuiltMapCalibration | null;
  onCommit: (document: CampusMapDocument, message: string) => void;
  onApplyReference: () => void;
  onNotice: (message: string) => void;
}) {
  const calibration = document.map.calibration;
  const [label, setLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [accuracy, setAccuracy] = useState('5');
  const visualReferenceUrlId = useId();
  const accuracyId = useId();

  const updateCalibration = (
    nextCalibration: MapCalibration | undefined,
    message: string,
  ) =>
    onCommit(
      {
        ...document,
        map: { ...document.map, calibration: nextCalibration },
      },
      message,
    );

  const addAnchor = () => {
    if (!draft) {
      onNotice('请先在原图上点击同一个真实地标');
      return;
    }
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedAccuracy = Number(accuracy);
    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      onNotice('请输入有效的 WGS-84 纬度和经度');
      return;
    }
    if (!Number.isFinite(parsedAccuracy) || parsedAccuracy <= 0) {
      onNotice('控制点来源精度必须大于 0 米');
      return;
    }
    const next =
      calibration ?? applyJiangyinReference(document, false).map.calibration;
    if (!next) return;
    const anchor: CalibrationAnchor = {
      id: createFeatureId('anchor'),
      label: label.trim() || undefined,
      image: draft,
      source: {
        crs: 'WGS84',
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      },
      wgs84: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      },
      accuracyMeters: parsedAccuracy,
    };
    updateCalibration(
      { ...next, anchors: [...next.anchors, anchor] },
      `已添加控制点${anchor.label ? `“${anchor.label}”` : ''}`,
    );
    setLabel('');
    setLatitude('');
    setLongitude('');
  };

  const localScale = built?.localScale({ x: 0.5, y: 0.5 });
  const isGeorectifiedGuide =
    document.map.basemapRevision === REFINED_GUIDE_REVISION;

  return (
    <div className="inspector-stack calibration-inspector">
      <div>
        <p className="section-label">校内导览图几何纠偏与地理参考</p>
        <p className="helper-text">
          当前底图保留原图的建筑、道路和中文标签。源图以 12
          个校界控制点拟合全局仿射，再重采样到北向上的 WGS-84
          网格；这不会把参考级开放数据提升为测绘真值。
        </p>
      </div>
      <label className="field-label" htmlFor={visualReferenceUrlId}>
        百度人工核对链接
        <Input
          id={visualReferenceUrlId}
          value={JIANGYIN_BAIDU_VISUAL_REFERENCE_URL}
          readOnly
        />
      </label>
      <div className="calibration-actions">
        <Button size="sm" onClick={onApplyReference}>
          <Crosshair />
          恢复几何纠偏底图与参考地点
        </Button>
        <a
          className="reference-link"
          href={JIANGYIN_BAIDU_VISUAL_REFERENCE_URL}
          target="_blank"
          rel="noreferrer"
        >
          打开百度参考图
        </a>
      </div>
      {calibration && (
        <label className="field-label">
          变换模型
          <select
            className="select-field"
            value={calibration.method}
            onChange={(event) =>
              updateCalibration(
                {
                  ...calibration,
                  method: event.target.value as MapCalibration['method'],
                },
                '已更新校准模型',
              )
            }
          >
            <option value="affine">全局仿射（3 点起）</option>
            <option value="thin-plate-spline">
              TPS 局部形变（推荐 6–12 点）
            </option>
          </select>
        </label>
      )}

      <div className="calibration-quality">
        <div>
          <span>{isGeorectifiedGuide ? '网格角点' : '控制点'}</span>
          <strong>{calibration?.anchors.length ?? 0}</strong>
        </div>
        <div>
          <span>校准状态</span>
          <strong>
            {built ? calibrationStatusLabel(built.quality.status) : '未成网'}
          </strong>
        </div>
        <div>
          <span>覆盖原图</span>
          <strong>
            {built ? `${Math.round(built.quality.coverage * 100)}%` : '—'}
          </strong>
        </div>
        <div>
          <span>局部比例</span>
          <strong>
            {localScale
              ? `${localScale.xMetersPerPixel.toFixed(2)} × ${localScale.yMetersPerPixel.toFixed(2)} m/px`
              : '—'}
          </strong>
        </div>
      </div>
      {built && (
        <p className="helper-text calibration-warning">
          {isGeorectifiedGuide ? (
            <>
              源图 12 点模型拟合 RMS 约{' '}
              {georectification.sourceModelQuality.fitRmsMeters.toFixed(1)}
              米、独立留一约{' '}
              {georectification.sourceModelQuality.leaveOneOutRmsMeters.toFixed(
                1,
              )}{' '}
              米、最大残差约{' '}
              {georectification.sourceModelQuality.maxErrorMeters.toFixed(1)}
              米。当前四角的近零残差只证明固定网格可逆，不代表图内地物达到米级精度。
            </>
          ) : (
            <>
              留一验证约 {built.quality.leaveOneOutRmsMeters?.toFixed(1) ?? '—'}
              米；控制点声明精度约{' '}
              {built.quality.declaredAccuracyRmsMeters?.toFixed(1) ?? '—'} 米；
              {built.quality.accuracyStatement}
            </>
          )}
        </p>
      )}

      <div className="calibration-form">
        <p className="section-label">新增控制点</p>
        <p className="helper-text">
          {draft
            ? `原图位置 x ${draft.x.toFixed(5)} · y ${draft.y.toFixed(5)}`
            : '先点击原图中的校门、路口或清晰楼角'}
        </p>
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="控制点名称"
        />
        <div className="two-columns">
          <Input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="WGS-84 纬度"
          />
          <Input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="WGS-84 经度"
          />
        </div>
        <label className="field-label" htmlFor={accuracyId}>
          来源精度（米）
          <Input
            id={accuracyId}
            type="number"
            min="0.1"
            step="0.1"
            value={accuracy}
            onChange={(event) => setAccuracy(event.target.value)}
          />
        </label>
        <Button size="sm" variant="outline" onClick={addAnchor}>
          <Crosshair />
          保存控制点
        </Button>
      </div>

      {calibration && calibration.anchors.length > 0 && (
        <div className="anchor-list">
          <p className="section-label">控制点列表</p>
          {calibration.anchors.map((anchor, index) => (
            <div key={anchor.id} className="anchor-row">
              <span>
                <strong>{anchor.label || `控制点 ${index + 1}`}</strong>
                <small>
                  {anchor.wgs84.latitude.toFixed(6)},{' '}
                  {anchor.wgs84.longitude.toFixed(6)}
                </small>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`删除${anchor.label || `控制点 ${index + 1}`}`}
                onClick={() =>
                  updateCalibration(
                    {
                      ...calibration,
                      anchors: calibration.anchors.filter(
                        (item) => item.id !== anchor.id,
                      ),
                    },
                    '已删除控制点',
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      {calibration && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateCalibration(undefined, '已清除地图校准')}
        >
          清除校准
        </Button>
      )}
      <p className="helper-text source-note">
        原图的边界控制坐标来自 OpenStreetMap way 1314812014；Overture
        建筑仅作现势性核对。 导览图仍属参考级，校门、建筑入口和路线应使用现场
        GNSS 独立复测。
      </p>
    </div>
  );
}

function LinkInspector({
  link,
  document,
  onChange,
}: {
  link: TraversalLink;
  document: CampusMapDocument;
  onChange: (document: CampusMapDocument) => void;
}) {
  const update = (patch: Partial<TraversalLink>) =>
    onChange({
      ...document,
      links: document.links.map((item) =>
        item.id === link.id ? { ...item, ...patch } : item,
      ),
    });
  return (
    <div className="inspector-stack">
      <p className="section-label">通行段</p>
      <label className="field-label" htmlFor={`link-name-${link.id}`}>
        名称
        <Input
          id={`link-name-${link.id}`}
          value={link.name ?? ''}
          placeholder="可选，例如：二教一层走廊"
          onChange={(event) =>
            update({ name: event.target.value || undefined })
          }
        />
      </label>
      <div className="two-columns">
        <label className="field-label">
          类型
          <select
            className="select-field"
            value={link.kind}
            onChange={(event) => {
              const kind = event.target.value as TraversalKind;
              update({
                kind,
                environment: environmentForKind(kind),
                access: accessForKind(kind),
              });
            }}
          >
            <option value="path">普通步道</option>
            <option value="building-passage">楼内穿行</option>
            <option value="arcade">有顶连廊</option>
            <option value="bridge">天桥</option>
            <option value="stairs">楼梯</option>
            <option value="elevator">电梯</option>
            <option value="ramp">坡道</option>
          </select>
        </label>
        <label className="field-label">
          方向
          <select
            className="select-field"
            value={link.direction}
            onChange={(event) =>
              update({
                direction: event.target.value as TraversalLink['direction'],
              })
            }
          >
            <option value="both">双向</option>
            <option value="forward">仅起点 → 终点</option>
          </select>
        </label>
      </div>
      <EnvironmentFields
        environment={link.environment}
        onChange={(environment) => update({ environment })}
      />
      <AccessFields
        access={link.access}
        onChange={(access) => update({ access })}
      />
      <label className="field-label">
        额外通行代价：{link.costMultiplier.toFixed(2)}×
        <input
          className="range-field"
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={link.costMultiplier}
          onChange={(event) =>
            update({ costMultiplier: Number(event.target.value) })
          }
        />
      </label>
    </div>
  );
}

function AreaInspector({
  area,
  document,
  onChange,
}: {
  area: WalkableArea;
  document: CampusMapDocument;
  onChange: (document: CampusMapDocument) => void;
}) {
  const update = (patch: Partial<WalkableArea>) =>
    onChange({
      ...document,
      areas: document.areas.map((item) =>
        item.id === area.id ? { ...item, ...patch } : item,
      ),
    });
  return (
    <div className="inspector-stack">
      <p className="section-label">自由通行面</p>
      <label className="field-label" htmlFor={`area-name-${area.id}`}>
        名称
        <Input
          id={`area-name-${area.id}`}
          value={area.name ?? ''}
          placeholder="例如：东运动场"
          onChange={(event) =>
            update({ name: event.target.value || undefined })
          }
        />
      </label>
      <EnvironmentFields
        environment={area.environment}
        onChange={(environment) => update({ environment })}
      />
      <AccessFields
        access={area.access}
        onChange={(access) => update({ access })}
      />
      <label className="field-label">
        地面通行代价：{area.costMultiplier.toFixed(2)}×
        <input
          className="range-field"
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={area.costMultiplier}
          onChange={(event) =>
            update({ costMultiplier: Number(event.target.value) })
          }
        />
      </label>
      <p className="helper-text">
        已标注 {area.obstacles.length}{' '}
        个障碍物。区域内节点会自动建立可见直达路径。
      </p>
    </div>
  );
}

function addLink(
  document: CampusMapDocument,
  from: TraversalNode,
  to: TraversalNode,
  geometry: MapPoint[],
  kind: TraversalKind,
): CampusMapDocument {
  if (
    from.id === to.id ||
    document.links.some(
      (link) =>
        link.kind === kind &&
        ((link.from === from.id && link.to === to.id) ||
          (link.from === to.id && link.to === from.id)),
    )
  ) {
    return document;
  }
  const access = accessForKind(kind);
  if (kind === 'building-passage') {
    access.schedule = {
      days: [0, 1, 2, 3, 4, 5, 6],
      opens: '07:00',
      closes: '22:00',
    };
  }
  return {
    ...document,
    links: [
      ...document.links,
      {
        id: createFeatureId('link'),
        from: from.id,
        to: to.id,
        kind,
        direction: 'both',
        geometry: [{ x: from.x, y: from.y }, ...geometry, { x: to.x, y: to.y }],
        environment: environmentForKind(kind),
        access,
        costMultiplier: 1,
      },
    ],
  };
}

type HomeProps = {
  initialMode?: AppMode;
  appView?: boolean;
};

export default function Home({
  initialMode = 'annotate',
  appView = false,
}: HomeProps = {}) {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [studentTab, setStudentTab] = useState<StudentTab>('map');
  const preview = useRoutePreview(studentTab === 'map');
  const [navigationSession, setNavigationSession] = useState<{
    route: CampusRoute;
    destination: string;
    origin: string;
    originLevelId: string;
    followLocation: boolean;
  } | null>(null);
  const [navigationSheetOpen, setNavigationSheetOpen] = useState(true);
  const navigationResumeRef = useRef<HTMLButtonElement>(null);
  const [tool, setTool] = useState<DrawingTool>('path');
  const [document, setDocument] = useState<CampusMapDocument>(
    createDefaultCampusMap,
  );
  const [persistenceState, setPersistenceState] = useState<
    'loading' | 'enabled' | 'paused'
  >('loading');
  const [currentLevelId, setCurrentLevelId] = useState('level-ground');
  const [selection, setSelection] = useState<FeatureSelection>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<MapPoint[]>([]);
  const [shadowHeight, setShadowHeight] = useState('30');
  const [shadowCursor, setShadowCursor] = useState<MapPoint | null>(null);
  const [redrawingShadowId, setRedrawingShadowId] = useState<string | null>(
    null,
  );
  const [calibrationDraft, setCalibrationDraft] = useState<MapPoint | null>(
    null,
  );
  const [draftStartNodeId, setDraftStartNodeId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [zoom, setZoom] = useState(appView ? APP_NAVIGATION_ZOOM : 1);
  const [verticalKind, setVerticalKind] = useState<
    'stairs' | 'elevator' | 'ramp'
  >('stairs');
  const [targetLevelId, setTargetLevelId] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelElevation, setNewLevelElevation] = useState('3.6');
  const [metersPerPixel, setMetersPerPixel] = useState('');
  const [startInput, setStartInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [geoPosition, setGeoPosition] = useState<GeoPosition | null>(null);
  const deviceHeading = useDeviceHeading(
    appView && studentTab === 'map',
    geoPosition,
  );
  const [locating, setLocating] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const { panelRef: navigationPanelRef, handleRef: navigationHandleRef } =
    useNavigationSheet(
      navigationSheetOpen && !selectedPlaceId,
      appView,
      setNavigationSheetOpen,
    );
  const [departureTime, setDepartureTime] = useState(localDateTimeValue);
  const weatherReport = useWeatherReport();
  const [audience, setAudience] = useState<'public' | 'campus'>('campus');
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [activeProfile, setActiveProfile] = useState<RouteProfile>('balanced');
  const [historyCount, setHistoryCount] = useState(0);
  const historyRef = useRef<CampusMapDocument[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const mapScrollRef = useRef<HTMLDivElement>(null);
  const mapStageRef = useRef<HTMLDivElement>(null);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const draftEndSnapDisabledRef = useRef(false);
  const locationWatchRef = useRef<LocationWatch | null>(null);
  const locationWatchSessionRef = useRef(0);
  const appFallbackCenteredRef = useRef(false);
  const locationFocusRequestedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);

  const campusNavigator = useMemo<CampusNavigator>(
    () => compileCampusMap(document),
    [document],
  );
  const mapCalibration = useMemo(
    () => tryBuildCalibration(document),
    [document],
  );
  const departureInstant = useMemo(
    () => parseCampusDateTime(departureTime),
    [departureTime],
  );
  const sunlightContext = useMemo(() => {
    if (!departureInstant) return null;
    const weather =
      weatherReport.state.status === 'ready'
        ? weatherAtTime(weatherReport.state.snapshot, departureInstant)
        : null;
    return createCampusSunlightContext({
      departureTime: departureInstant,
      weather,
      basemapSupported: isCurrentBasemap(document),
      buildings: document.solarBuildings,
    });
  }, [departureInstant, document, weatherReport.state]);
  const diagnostics = useMemo(
    () => campusNavigator.diagnostics(),
    [campusNavigator],
  );
  const nodesById = useMemo(
    () => new Map(document.nodes.map((node) => [node.id, node])),
    [document.nodes],
  );
  const currentLevel =
    document.levels.find((level) => level.id === currentLevelId) ??
    document.levels[0];
  const places = useMemo(
    () =>
      [...document.places].sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN'),
      ),
    [document.places],
  );
  const calibrationAnchorCount = document.map.calibration?.anchors.length ?? 0;
  const toolCounts = useMemo<Record<DrawingTool, number>>(
    () => ({
      path: document.links.filter(
        (link) => link.kind === 'path' && link.geometry.length <= 2,
      ).length,
      curve: document.links.filter(
        (link) => link.kind === 'path' && link.geometry.length > 2,
      ).length,
      area: document.areas.length,
      shadow: (document.solarBuildings ?? []).length,
      obstacle: document.areas.reduce(
        (count, area) => count + area.obstacles.length,
        0,
      ),
      building: document.links.filter(
        (link) => link.kind === 'building-passage',
      ).length,
      vertical: document.links.filter((link) =>
        ['stairs', 'elevator', 'ramp'].includes(link.kind),
      ).length,
      place: document.places.length,
      calibration: calibrationAnchorCount,
      select: document.nodes.filter((node) => node.kind === 'portal').length,
    }),
    [calibrationAnchorCount, document],
  );
  const activeRoute = preview.session
    ? (preview.leg?.route ?? null)
    : (navigationSession?.route ??
      alternatives.find((alternative) => alternative.profile === activeProfile)
        ?.route ??
      null);
  const routeSegments = activeRoute
    ? splitRouteByLevel(activeRoute.geometry, currentLevelId)
    : [];
  const selectedNode =
    selection?.type === 'node' ? nodesById.get(selection.id) : undefined;
  const selectedLink =
    selection?.type === 'link'
      ? document.links.find((link) => link.id === selection.id)
      : undefined;
  const selectedArea =
    selection?.type === 'area'
      ? document.areas.find((area) => area.id === selection.id)
      : undefined;
  const selectedShadow =
    selection?.type === 'shadow'
      ? document.solarBuildings?.find(
          (building) => building.id === selection.id,
        )
      : undefined;
  const shadowDraft =
    tool === 'shadow' && draftPoints.length > 0
      ? rectangleFootprint(
          draftPoints[0],
          draftPoints[1] ?? shadowCursor ?? draftPoints[0],
        )
      : [];
  const selectedPlace = selectedPlaceId
    ? places.find((place) => place.id === selectedPlaceId)
    : undefined;
  const selectedPlaceNode = selectedPlace
    ? nodesById.get(selectedPlace.nodeId)
    : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let candidates: Array<{ key: string; value: string }>;
      try {
        candidates = [
          { key: STORAGE_KEY, value: window.localStorage.getItem(STORAGE_KEY) },
          {
            key: REFINED_STORAGE_KEY,
            value: window.localStorage.getItem(REFINED_STORAGE_KEY),
          },
          {
            key: VECTOR_STORAGE_KEY,
            value: window.localStorage.getItem(VECTOR_STORAGE_KEY),
          },
          {
            key: PREVIOUS_STORAGE_KEY,
            value: window.localStorage.getItem(PREVIOUS_STORAGE_KEY),
          },
          {
            key: LEGACY_STORAGE_KEY,
            value: window.localStorage.getItem(LEGACY_STORAGE_KEY),
          },
        ].filter(
          (candidate): candidate is { key: string; value: string } =>
            candidate.value !== null,
        );
      } catch (error) {
        setNotice(
          error instanceof Error
            ? `无法读取浏览器本地存储，自动保存已暂停：${error.message}`
            : '无法读取浏览器本地存储，自动保存已暂停',
        );
        setPersistenceState('paused');
        return;
      }
      if (candidates.length === 0) {
        setPersistenceState('enabled');
        return;
      }

      let firstReadable: CampusMapDocument | null = null;
      const failures: string[] = [];
      for (const candidate of candidates) {
        try {
          const parsed = parseCampusMap(candidate.value);
          firstReadable ??= parsed;
          const restoredBundledNetwork =
            isReferenceOnlyPlaceholder(parsed) ||
            isPreviousBundledCampusMap(parsed);
          const source = restoredBundledNetwork
            ? createDefaultCampusMap()
            : parsed;
          const wasCurrent = isCurrentBasemap(source);
          const migrated = migrateToCurrentBasemap(source);
          setDocument(migrated);
          setCurrentLevelId(migrated.levels[0].id);
          setMetersPerPixel(migrated.map.metersPerPixel?.toString() ?? '');
          if (failures.length > 0) {
            setNotice(
              '新版存储读取失败，已从较早备份打开；为避免覆盖较新的原数据，自动保存已暂停，请先导出 JSON 确认',
            );
            setPersistenceState('paused');
          } else {
            if (restoredBundledNetwork) {
              setNotice('已接入最新校园标注，课表可自动对应教学楼');
            } else if (!wasCurrent || candidate.key !== STORAGE_KEY) {
              setNotice(
                '已从本地数据恢复，并将旧底图上的路线、区域和地点经 WGS-84 自动迁移；旧存储仍保留为备份',
              );
            }
            setPersistenceState('enabled');
          }
          return;
        } catch (error) {
          failures.push(
            error instanceof Error ? error.message : '未知读取或迁移错误',
          );
        }
      }

      if (firstReadable) {
        setDocument(firstReadable);
        setCurrentLevelId(firstReadable.levels[0].id);
        setMetersPerPixel(firstReadable.map.metersPerPixel?.toString() ?? '');
      }
      setNotice(
        `本地数据无法安全迁移，已暂停自动保存，旧数据未被覆盖：${failures.at(-1) ?? '未知错误'}`,
      );
      setPersistenceState('paused');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (appView || persistenceState !== 'enabled') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeCampusMap(document));
    } catch {
      window.setTimeout(() => {
        setPersistenceState('paused');
        setNotice('自动保存失败，请立即导出 JSON 备份');
      }, 0);
    }
  }, [appView, document, persistenceState]);

  useEffect(() => {
    if (!appView) return;
    const syncSavedMap = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = parseCampusMap(raw);
        const source =
          isPreviousBundledCampusMap(parsed) ||
          isReferenceOnlyPlaceholder(parsed)
            ? createDefaultCampusMap()
            : parsed;
        const updated = migrateToCurrentBasemap(source);
        if (sameCampusMapContent(updated, document)) return;
        setDocument(updated);
        setCurrentLevelId((level) =>
          updated.levels.some((item) => item.id === level)
            ? level
            : updated.levels[0].id,
        );
        if (!navigationSession) setAlternatives([]);
        setSelectedPlaceId(null);
        setNotice('已同步最新标注，课表地点与每日行程已更新');
      } catch {
        setNotice('最新标注暂时无法读取，继续使用当前地图');
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue !== null) syncSavedMap();
    };
    const onVisibility = () => {
      if (!window.document.hidden) syncSavedMap();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncSavedMap);
    window.document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncSavedMap);
      window.document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [appView, document, navigationSession]);

  const commit = useCallback(
    (next: CampusMapDocument, message?: string) => {
      if (next === document) return;
      historyRef.current = [
        ...historyRef.current.slice(-(HISTORY_LIMIT - 1)),
        document,
      ];
      setHistoryCount(historyRef.current.length);
      setDocument({ ...next, updatedAt: new Date().toISOString() });
      setAlternatives([]);
      if (message) setNotice(message);
    },
    [document],
  );

  const clearDraft = useCallback(() => {
    setDraftPoints([]);
    setShadowCursor(null);
    setRedrawingShadowId(null);
    setCalibrationDraft(null);
    setDraftStartNodeId(null);
    setActiveNodeId(null);
    draftEndSnapDisabledRef.current = false;
  }, []);

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setDocument(previous);
    setHistoryCount(historyRef.current.length);
    setSelection(null);
    clearDraft();
    setNotice('已撤销上一步几何编辑');
  };

  const chooseTool = (nextTool: DrawingTool) => {
    setTool(nextTool);
    if (nextTool === 'shadow') setCurrentLevelId(DEFAULT_LEVEL.id);
    clearDraft();
    if (nextTool !== 'select') setSelection(null);
    setNotice(TOOL_ITEMS.find((item) => item.id === nextTool)?.hint ?? '');
  };

  const mapPointFromEvent = (
    event: ReactMouseEvent<SVGSVGElement>,
  ): MapPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const mapPixelRadius = useCallback(
    (screenPixels: number, svg = mapSvgRef.current): number => {
      const bounds = svg?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return screenPixels / zoom;
      }
      return mapPixelRadiusForScreenPixels(
        screenPixels,
        bounds.width,
        bounds.height,
      );
    },
    [zoom],
  );

  const focusMapPoint = useCallback(
    (
      point: MapPoint,
      behavior: ScrollBehavior = 'smooth',
      immediate = false,
    ) => {
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
      const focus = () => {
        focusFrameRef.current = null;
        const scroller = mapScrollRef.current;
        const stage = mapStageRef.current;
        if (!scroller || !stage) return;
        const bounds = scroller.getBoundingClientRect();
        const shell = scroller.closest('main');
        let visibleTop = 0;
        let visibleBottom = scroller.clientHeight;
        if (appView && shell) {
          for (const selector of ['.topbar', '.map-toolbar']) {
            const rect = shell.querySelector(selector)?.getBoundingClientRect();
            if (rect)
              visibleTop = Math.max(visibleTop, rect.bottom - bounds.top + 12);
          }
          const sheet =
            shell.getAttribute('data-place-selected') === 'true'
              ? '.place-action-sheet'
              : '.left-panel';
          for (const selector of [
            sheet,
            '.route-preview-panel',
            '.student-tab-bar',
          ]) {
            const rect = shell.querySelector(selector)?.getBoundingClientRect();
            if (rect && rect.height > 0)
              visibleBottom = Math.min(
                visibleBottom,
                rect.top - bounds.top - 12,
              );
          }
        }
        scroller.scrollTo({
          left: point.x * stage.offsetWidth - scroller.clientWidth / 2,
          top:
            point.y * stage.offsetHeight -
            (visibleTop + Math.max(visibleTop, visibleBottom)) / 2,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : behavior,
        });
      };
      if (immediate) focus();
      else focusFrameRef.current = window.requestAnimationFrame(focus);
    },
    [appView],
  );

  useEffect(() => {
    if (!appView) return;
    const scroller = mapScrollRef.current;
    if (!scroller) return;
    let drag: {
      id: number;
      x: number;
      y: number;
      left: number;
      top: number;
      moved: boolean;
    } | null = null;
    let suppressClick = false;
    const interrupt = () => {
      locationFocusRequestedRef.current = false;
      appFallbackCenteredRef.current = true;
      if (focusFrameRef.current !== null)
        window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = null;
      scroller.scrollTo({
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        behavior: 'instant',
      });
    };
    const down = (event: PointerEvent) => {
      interrupt();
      suppressClick = false;
      // Native touch scrolling supplies momentum and handles pointer cancellation.
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        moved: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      suppressClick = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.scrollTo({
        left: drag.left - dx,
        top: drag.top - dy,
        behavior: 'instant',
      });
      event.preventDefault();
    };
    const end = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      if (scroller.hasPointerCapture(event.pointerId))
        scroller.releasePointerCapture(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    };
    scroller.addEventListener('pointerdown', down);
    scroller.addEventListener('pointermove', move);
    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointercancel', end);
    scroller.addEventListener('lostpointercapture', end);
    scroller.addEventListener('wheel', interrupt, { passive: true });
    scroller.addEventListener('keydown', interrupt);
    scroller.addEventListener('click', click, true);
    return () => {
      if (focusFrameRef.current !== null)
        window.cancelAnimationFrame(focusFrameRef.current);
      scroller.removeEventListener('pointerdown', down);
      scroller.removeEventListener('pointermove', move);
      scroller.removeEventListener('pointerup', end);
      scroller.removeEventListener('pointercancel', end);
      scroller.removeEventListener('lostpointercapture', end);
      scroller.removeEventListener('wheel', interrupt);
      scroller.removeEventListener('keydown', interrupt);
      scroller.removeEventListener('click', click, true);
    };
  }, [appView]);

  useEffect(() => {
    if (!appView) return;
    const scroller = mapScrollRef.current;
    const shell = scroller?.closest('main');
    if (!scroller || !shell) return;
    const panel = shell.querySelector(
      selectedPlace
        ? '.place-action-sheet'
        : navigationSheetOpen
          ? '.left-panel'
          : '.app-navigation-dock',
    );
    const tabBar = shell.querySelector('.student-tab-bar');
    const dock = shell.querySelector('.app-navigation-dock');
    const measure = () => {
      if (studentTab !== 'map') return;
      if (dock)
        shell.style.setProperty(
          '--navigation-dock-height',
          `${dock.getBoundingClientRect().height}px`,
        );
      const bounds = scroller.getBoundingClientRect();
      const panelY =
        panel && navigationSheetOpen && !selectedPlace
          ? new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42
          : 0;
      const top = Math.min(
        panel ? panel.getBoundingClientRect().top - panelY : bounds.bottom,
        tabBar?.getBoundingClientRect().top ?? bounds.bottom,
      );
      scroller.style.setProperty(
        '--map-bottom-clearance',
        `${Math.max(0, bounds.bottom - top) + 24}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (panel) observer.observe(panel);
    if (tabBar) observer.observe(tabBar);
    if (dock) observer.observe(dock);
    measure();
    return () => observer.disconnect();
  }, [
    appView,
    selectedPlace,
    studentTab,
    navigationSheetOpen,
    navigationSession,
  ]);

  useEffect(() => {
    if (
      appView &&
      !navigationSheetOpen &&
      !selectedPlaceId &&
      studentTab === 'map'
    ) {
      const focused = window.document.activeElement;
      if (
        focused &&
        (navigationPanelRef.current?.contains(focused) ||
          focused === window.document.body)
      )
        navigationResumeRef.current?.focus({ preventScroll: true });
    }
  }, [
    appView,
    navigationSheetOpen,
    selectedPlaceId,
    studentTab,
    navigationPanelRef,
  ]);

  const selectAppPlace = (placeId: string) => {
    if (!appView || preview.session) return;
    if (navigationSession) {
      setNavigationSheetOpen(true);
      setNotice('正在导航中，结束后可选择新的目的地');
      return;
    }
    const place = places.find((item) => item.id === placeId);
    const node = place ? nodesById.get(place.nodeId) : undefined;
    if (!place || !node) return;

    setSelectedPlaceId(place.id);
    setDestinationInput(place.name);
    setAlternatives([]);
    setCurrentLevelId(node.levelId);
    setNotice(`已选择${place.name}`);
  };

  const handleSelect = (point: MapPoint, svg = mapSvgRef.current) => {
    const building =
      currentLevelId === DEFAULT_LEVEL.id
        ? [...(document.solarBuildings ?? [])]
            .reverse()
            .find((item) => pointInPolygon(point, item.footprint))
        : undefined;
    if (building) return setSelection({ type: 'shadow', id: building.id });
    const node = nearestNode(
      document,
      point,
      currentLevelId,
      mapPixelRadius(8, svg),
    );
    if (node) return setSelection({ type: 'node', id: node.id });
    const projected = nearestLink(
      document,
      point,
      currentLevelId,
      mapPixelRadius(6, svg),
    );
    if (projected) return setSelection({ type: 'link', id: projected.link.id });
    const area = [...document.areas]
      .reverse()
      .find(
        (item) =>
          item.levelId === currentLevelId &&
          pointInPolygon(point, item.boundary),
      );
    setSelection(area ? { type: 'area', id: area.id } : null);
  };

  const handleMapClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (mode !== 'annotate') {
      if (appView) setSelectedPlaceId(null);
      return;
    }
    const point = mapPointFromEvent(event);
    if (tool === 'select') return handleSelect(point, event.currentTarget);
    if (tool === 'shadow') {
      setDraftPoints((points) =>
        points.length === 1 ? [points[0], point] : [point],
      );
      setShadowCursor(point);
      setNotice(
        draftPoints.length === 1
          ? '矩形已选好，设置高度后点击“保存阴影”'
          : '已选第一个角，请点击矩形的另一个对角',
      );
      return;
    }
    if (tool === 'calibration') {
      setCalibrationDraft(point);
      setNotice('已选择原图控制点，请在右侧填写同一地标的 WGS-84 坐标');
      return;
    }
    if (tool === 'area' || tool === 'obstacle') {
      setDraftPoints((points) => [...points, point]);
      if (tool === 'obstacle' && !selectedArea) {
        handleSelect(point, event.currentTarget);
      }
      return;
    }
    const snapThreshold = event.altKey
      ? NO_SNAP_THRESHOLD
      : mapPixelRadius(SNAP_RADIUS_SCREEN_PIXELS, event.currentTarget);
    if (tool === 'vertical') {
      if (!targetLevelId || targetLevelId === currentLevelId) {
        setNotice('请先选择一个不同的目标层级');
        return;
      }
      const first = insertSnappedNode(
        document,
        point,
        currentLevelId,
        snapThreshold,
        'portal',
      );
      const second = insertSnappedNode(
        first.document,
        point,
        targetLevelId,
        snapThreshold,
        'portal',
      );
      const next = addLink(
        second.document,
        first.node,
        second.node,
        [],
        verticalKind,
      );
      commit(
        next,
        `已添加${verticalKind === 'stairs' ? '楼梯' : verticalKind === 'elevator' ? '电梯' : '坡道'}连接`,
      );
      setSelection({ type: 'link', id: next.links.at(-1)?.id ?? '' });
      return;
    }
    if (tool === 'place') {
      const inserted = insertSnappedNode(
        document,
        point,
        currentLevelId,
        snapThreshold,
      );
      if (inserted.changed) commit(inserted.document);
      setSelection({ type: 'node', id: inserted.node.id });
      setTool('select');
      setNotice('请在右侧填写地点名称；经纬度将由地图校准自动换算');
      return;
    }
    if (tool === 'curve' || tool === 'building') {
      if (!draftStartNodeId) {
        const inserted = insertSnappedNode(
          document,
          point,
          currentLevelId,
          snapThreshold,
          tool === 'building' ? 'portal' : 'junction',
        );
        if (inserted.changed) commit(inserted.document);
        setDraftStartNodeId(inserted.node.id);
        setDraftPoints([{ x: inserted.node.x, y: inserted.node.y }]);
        draftEndSnapDisabledRef.current = false;
        setNotice(
          '继续点击添加转折点；末点靠近路网会自动接入，按住 Option / Alt 可精确落点',
        );
      } else {
        draftEndSnapDisabledRef.current = event.altKey;
        setDraftPoints((points) => [...points, point]);
      }
      return;
    }

    const active = activeNodeId
      ? document.nodes.find((node) => node.id === activeNodeId)
      : undefined;
    if (
      active &&
      pointDistancePixels(active, point) < MIN_LINK_LENGTH_MAP_PIXELS
    ) {
      setNotice('落点与当前起点重合，请稍微移开后再添加小路');
      return;
    }
    const inserted = insertSnappedNode(
      document,
      point,
      currentLevelId,
      snapThreshold,
      'junction',
      active ? continuationSnapExclusions(active.id) : undefined,
    );
    let next = inserted.document;
    if (active && active.id !== inserted.node.id) {
      next = addLink(next, active, inserted.node, [], 'path');
    }
    if (next !== document) commit(next);
    setActiveNodeId(inserted.node.id);
    setNotice(
      '继续点击绘制相连步道；靠近其他道路会自动接入，按住 Option / Alt 可关闭吸附',
    );
  };

  const finishDraft = () => {
    if (tool === 'shadow') {
      const heightMeters = Number(shadowHeight);
      if (!Number.isFinite(heightMeters) || heightMeters <= 0) {
        setNotice('建筑高度必须是大于 0 的数字');
        return;
      }
      if (
        draftPoints.length !== 2 ||
        Math.abs(draftPoints[0].x - draftPoints[1].x) * MAP_WIDTH < 1 ||
        Math.abs(draftPoints[0].y - draftPoints[1].y) * MAP_HEIGHT < 1
      ) {
        setNotice('请点击两个不同的对角，矩形宽高至少为 1 个地图像素');
        return;
      }
      const buildings = document.solarBuildings ?? [];
      const previous = buildings.find(
        (building) => building.id === redrawingShadowId,
      );
      const building = {
        id: previous?.id ?? createFeatureId('shadow'),
        name: previous?.name ?? `阴影建筑 ${buildings.length + 1}`,
        heightMeters,
        footprint: rectangleFootprint(draftPoints[0], draftPoints[1]),
      };
      commit(
        {
          ...document,
          solarBuildings: previous
            ? buildings.map((item) =>
                item.id === previous.id ? building : item,
              )
            : [...buildings, building],
        },
        '已保存矩形与建筑高度',
      );
      clearDraft();
      setSelection({ type: 'shadow', id: building.id });
      setTool('select');
      return;
    }
    if (tool === 'curve' || tool === 'building') {
      if (!draftStartNodeId || draftPoints.length < 2) {
        setNotice('至少再点击一个终点');
        return;
      }
      const lastPoint = draftPoints.at(-1) as MapPoint;
      const start = document.nodes.find((node) => node.id === draftStartNodeId);
      if (!start) {
        setNotice('找不到当前路径起点，请取消后重新绘制');
        return;
      }
      if (pointDistancePixels(start, lastPoint) < MIN_LINK_LENGTH_MAP_PIXELS) {
        setNotice('终点与起点重合，请稍微移开后再完成小路');
        return;
      }
      const inserted = insertSnappedNode(
        document,
        lastPoint,
        currentLevelId,
        draftEndSnapDisabledRef.current
          ? NO_SNAP_THRESHOLD
          : mapPixelRadius(SNAP_RADIUS_SCREEN_PIXELS),
        tool === 'building' ? 'portal' : 'junction',
        continuationSnapExclusions(start.id),
      );
      if (start.id === inserted.node.id) {
        setNotice('起点和终点不能相同');
        return;
      }
      let next = inserted.document;
      if (tool === 'building') {
        next = {
          ...next,
          nodes: next.nodes.map((node) =>
            node.id === start.id || node.id === inserted.node.id
              ? { ...node, kind: 'portal' }
              : node,
          ),
        };
      }
      next = addLink(
        next,
        start,
        inserted.node,
        draftPoints.slice(1, -1),
        tool === 'building' ? 'building-passage' : 'path',
      );
      commit(
        next,
        tool === 'building'
          ? '已添加楼内穿行通道，可继续编辑开放时间'
          : '已添加曲线路径',
      );
      clearDraft();
      setSelection({ type: 'link', id: next.links.at(-1)?.id ?? '' });
      setTool('select');
      return;
    }
    if (tool === 'area') {
      if (draftPoints.length < 3) {
        setNotice('通行面至少需要 3 个边界点');
        return;
      }
      const area: WalkableArea = {
        id: createFeatureId('area'),
        levelId: currentLevelId,
        boundary: draftPoints,
        obstacles: [],
        environment: { ...DEFAULT_ENVIRONMENT },
        access: { ...DEFAULT_ACCESS },
        costMultiplier: 1,
      };
      commit(
        { ...document, areas: [...document.areas, area] },
        '已添加自由通行面；道路节点落在其中时会自动连通',
      );
      setDraftPoints([]);
      setSelection({ type: 'area', id: area.id });
      setTool('select');
      return;
    }
    if (tool === 'obstacle') {
      if (draftPoints.length < 3) {
        setNotice('障碍物至少需要 3 个边界点');
        return;
      }
      const area =
        selectedArea ??
        document.areas.find(
          (item) =>
            item.levelId === currentLevelId &&
            draftPoints.every((point) => pointInPolygon(point, item.boundary)),
        );
      if (
        !area ||
        !draftPoints.every((point) => pointInPolygon(point, area.boundary))
      ) {
        setNotice('障碍物必须完整位于一个已选择的通行面内');
        return;
      }
      const nextArea = {
        ...area,
        obstacles: [
          ...area.obstacles,
          { id: createFeatureId('obstacle'), boundary: draftPoints },
        ],
      };
      commit(
        {
          ...document,
          areas: document.areas.map((item) =>
            item.id === area.id ? nextArea : item,
          ),
        },
        '已添加障碍物，自动路线不会穿过这里',
      );
      setDraftPoints([]);
      setSelection({ type: 'area', id: area.id });
      setTool('select');
    }
  };

  const addLevel = () => {
    if (!newLevelName.trim()) {
      setNotice('请输入层级名称');
      return;
    }
    const level = {
      id: createFeatureId('level'),
      name: newLevelName.trim(),
      elevationMeters: Number(newLevelElevation) || 0,
    };
    commit(
      { ...document, levels: [...document.levels, level] },
      `已添加层级“${level.name}”`,
    );
    setCurrentLevelId(level.id);
    setNewLevelName('');
    setTargetLevelId(document.levels[0]?.id ?? '');
  };

  const removeSelection = () => {
    if (!selection) return;
    commit(deleteFeature(document, selection), '已删除所选要素');
    setSelection(null);
  };

  const exportDocument = () => {
    const blob = new Blob([serializeCampusMap(document)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `njust-campus-network-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('已导出 v2 校园通行网络');
  };

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCampusMap(await file.text());
      const wasCurrent = isCurrentBasemap(parsed);
      const migrated = migrateToCurrentBasemap(parsed);
      commit(
        migrated,
        wasCurrent
          ? '已导入几何纠偏底图版校园通行网络'
          : '已导入并将旧标注迁移到几何纠偏底图',
      );
      setCurrentLevelId(migrated.levels[0].id);
      setMetersPerPixel(migrated.map.metersPerPixel?.toString() ?? '');
      setSelection(null);
      clearDraft();
      setPersistenceState('enabled');
    } catch (error) {
      setNotice(
        error instanceof Error ? `导入失败：${error.message}` : '导入失败',
      );
    } finally {
      event.target.value = '';
    }
  };

  const updateScale = () => {
    const value = Number(metersPerPixel);
    if (metersPerPixel && (!Number.isFinite(value) || value <= 0)) {
      setNotice('米/像素比例必须大于 0');
      return;
    }
    commit(
      {
        ...document,
        map: {
          ...document.map,
          metersPerPixel: metersPerPixel ? value : undefined,
        },
      },
      '地图比例已保存',
    );
  };

  const applyReferenceCalibration = () => {
    try {
      const wasCurrent = isCurrentBasemap(document);
      const migrated = migrateToCurrentBasemap(document);
      commit(
        applyJiangyinReference(migrated, true),
        wasCurrent
          ? '已恢复几何纠偏底图校准与 12 个参考地点'
          : '已将全部标注迁移到几何纠偏底图，并载入 12 个参考地点',
      );
      setTool('calibration');
      setCalibrationDraft(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `底图迁移失败：${error.message}`
          : '底图迁移失败',
      );
    }
  };

  const clearLocationWatch = useCallback(() => {
    locationWatchSessionRef.current += 1;
    const activeWatch = locationWatchRef.current;
    locationWatchRef.current = null;
    if (!activeWatch) return;

    if (activeWatch.platform === 'native') {
      void Geolocation.clearWatch({ id: activeWatch.id }).catch(
        () => undefined,
      );
      return;
    }
    window.navigator.geolocation?.clearWatch(activeWatch.id);
  }, []);

  const locate = useCallback(() => {
    if (!mapCalibration) {
      setNotice('请先在“地图校准”中载入或建立至少 3 个分散控制点');
      return;
    }

    clearLocationWatch();
    const watchSession = locationWatchSessionRef.current;
    let receivedPosition = false;
    let locationInterrupted = false;
    setLocating(true);
    setLocationTracking(true);
    setStartInput('我的位置');

    const applyPosition = (coordinates: LocationCoordinates) => {
      if (locationWatchSessionRef.current !== watchSession) return;
      const point = mapCalibration.wgs84ToImage({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      setLocating(false);
      if (
        !point ||
        point.x < -0.1 ||
        point.x > 1.1 ||
        point.y < -0.1 ||
        point.y > 1.1
      ) {
        setNotice('定位结果超出校准范围，请检查控制点或设备位置');
        locationInterrupted = true;
        return;
      }
      setGeoPosition({
        ...point,
        accuracy: coordinates.accuracy,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
      if (locationFocusRequestedRef.current) {
        locationFocusRequestedRef.current = false;
        focusMapPoint(point);
      }
      if (!receivedPosition || locationInterrupted) {
        setNotice(
          `持续定位已开启，设备精度约 ±${Math.round(coordinates.accuracy)} 米`,
        );
        receivedPosition = true;
        locationInterrupted = false;
      }
    };
    const applyError = (error: unknown) => {
      if (locationWatchSessionRef.current !== watchSession) return;
      setLocating(false);
      locationFocusRequestedRef.current = false;
      locationInterrupted = true;
      if (geolocationPermissionDenied(error)) {
        clearLocationWatch();
        setLocationTracking(false);
      }
      setNotice(geolocationErrorMessage(error));
    };
    const applyStartupError = (error: unknown) => {
      if (locationWatchSessionRef.current !== watchSession) return;
      clearLocationWatch();
      setLocating(false);
      locationFocusRequestedRef.current = false;
      setLocationTracking(false);
      setNotice(geolocationErrorMessage(error));
    };
    const options = {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 5_000,
    };

    if (Capacitor.isNativePlatform()) {
      void Geolocation.watchPosition(
        {
          ...options,
          enableLocationFallback: true,
          minimumUpdateInterval: LOCATION_UPDATE_INTERVAL_MS,
          interval: LOCATION_UPDATE_INTERVAL_MS,
        },
        (position, error) => {
          if (error || !position) {
            applyError(error);
            return;
          }
          applyPosition(position.coords);
        },
      ).then((id) => {
        if (locationWatchSessionRef.current !== watchSession) {
          void Geolocation.clearWatch({ id }).catch(() => undefined);
          return;
        }
        locationWatchRef.current = { platform: 'native', id };
      }, applyStartupError);
      return;
    }
    if (!window.navigator.geolocation) {
      clearLocationWatch();
      setLocating(false);
      setLocationTracking(false);
      setNotice('当前浏览器不支持定位');
      return;
    }
    try {
      const id = window.navigator.geolocation.watchPosition(
        (position) => applyPosition(position.coords),
        applyError,
        options,
      );
      if (locationWatchSessionRef.current === watchSession) {
        locationWatchRef.current = { platform: 'web', id };
      } else {
        window.navigator.geolocation.clearWatch(id);
      }
    } catch (error) {
      applyStartupError(error);
    }
  }, [clearLocationWatch, focusMapPoint, mapCalibration]);

  useEffect(() => {
    if (!appView || !mapCalibration) return;
    const frame = window.requestAnimationFrame(locate);
    return () => {
      window.cancelAnimationFrame(frame);
      clearLocationWatch();
    };
  }, [appView, clearLocationWatch, locate, mapCalibration]);

  useEffect(() => {
    if (appView) return;
    return clearLocationWatch;
  }, [appView, clearLocationWatch]);

  const calculateRoutes = (
    requestedDestination: string = destinationInput,
  ): boolean => {
    if (appView && navigationSession) return false;
    const destinationName = requestedDestination.trim();
    if (destinationName !== destinationInput) {
      setDestinationInput(destinationName);
    }
    const namedOrigin =
      startInput.trim() === '我的位置' && geoPosition
        ? null
        : campusNavigator.resolvePlaceEndpoint(startInput);
    const originEndpoint =
      startInput.trim() === '我的位置' && geoPosition
        ? {
            point: { x: geoPosition.x, y: geoPosition.y },
            levelId: currentLevelId,
          }
        : namedOrigin;
    const destination = campusNavigator.resolvePlaceEndpoint(destinationName);
    if (!originEndpoint) {
      setNotice('请选择一个已标注的起点，或先获取浏览器定位');
      return false;
    }
    if (!destination) {
      setNotice('找不到目的地，请从地点列表中选择');
      return false;
    }
    const departure = departureInstant;
    if (!departure || !sunlightContext) {
      setNotice('出发时间无效');
      return false;
    }
    const routes = ROUTE_PROFILES.map(({ id }) => ({
      profile: id,
      route: campusNavigator.route({
        origin: originEndpoint,
        destination,
        profile: id,
        departureTime: departure,
        audience,
        wheelchair: id === 'accessible',
        sunlight: sunlightContext,
      }),
    }));
    setAlternatives(routes);
    const preferred =
      routes.find((item) => item.profile === activeProfile && item.route) ??
      routes.find((item) => item.route);
    if (preferred) {
      setActiveProfile(preferred.profile);
      const routeLevels = new Set(
        preferred.route?.geometry.map((point) => point.levelId),
      );
      if (routeLevels.size > 0 && !routeLevels.has(currentLevelId)) {
        setCurrentLevelId(
          preferred.route?.geometry[0]?.levelId ?? currentLevelId,
        );
      }
      setNotice(
        sunlightContext.status === 'active'
          ? '已按实时太阳位置和建筑阴影计算五种路线方案'
          : `${sunlightInactiveLabel(sunlightContext.reason)}；已计算其他路线条件`,
      );
      if (appView && preferred.route) {
        navigationPanelRef.current
          ?.querySelectorAll('details')
          .forEach((details) => {
            details.open = false;
          });
        setNavigationSession({
          route: preferred.route,
          destination: destinationName,
          origin: startInput,
          followLocation: true,
          originLevelId: preferred.route.geometry[0]?.levelId ?? currentLevelId,
        });
        if (!locationTracking) locate();
        setSelectedPlaceId(null);
        setNavigationSheetOpen(false);
      }
      return true;
    } else {
      setNotice(
        '当前时间和通行条件下没有可用路线，请检查门禁、临时关闭或网络连通性',
      );
      return false;
    }
  };

  // Depend on the fixed navigation target, not the route replaced by each fix.
  // Only live navigation follows GPS. Scheduled legs keep their planned origin.
  const navigationDestination = navigationSession?.followLocation
    ? navigationSession.destination
    : undefined;
  const navigationOriginLevelId = navigationSession?.originLevelId;
  useEffect(() => {
    if (!navigationDestination || !navigationOriginLevelId || !geoPosition)
      return;
    const frame = window.requestAnimationFrame(() => {
      const destination = campusNavigator.resolvePlaceEndpoint(
        navigationDestination,
      );
      if (!destination) return;
      const departure = new Date();
      const sunlight = createCampusSunlightContext({
        departureTime: departure,
        weather:
          weatherReport.state.status === 'ready'
            ? weatherAtTime(weatherReport.state.snapshot, departure)
            : null,
        basemapSupported: isCurrentBasemap(document),
      });
      const routes = ROUTE_PROFILES.map(({ id }) => ({
        profile: id,
        route: campusNavigator.route({
          origin: {
            point: { x: geoPosition.x, y: geoPosition.y },
            levelId: navigationOriginLevelId,
          },
          destination,
          profile: id,
          departureTime: departure,
          audience,
          wheelchair: id === 'accessible',
          sunlight,
        }),
      }));
      setAlternatives(routes);
      const route = routes.find(
        (item) => item.profile === activeProfile,
      )?.route;
      if (!route) {
        setNotice('当前位置暂时无法规划路线，保留上次路线并继续定位');
        return;
      }
      setNavigationSession((session) =>
        session ? { ...session, route, origin: '我的位置' } : session,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    navigationDestination,
    navigationOriginLevelId,
    geoPosition,
    campusNavigator,
    document,
    activeProfile,
    audience,
    weatherReport.state,
  ]);

  const recenterOnCurrentLocation = () => {
    setSelectedPlaceId(null);
    setZoom(APP_NAVIGATION_ZOOM);
    locationFocusRequestedRef.current = !geoPosition;
    if (geoPosition) {
      focusMapPoint(geoPosition);
      setNotice(
        `已回到当前位置，设备精度约 ±${Math.round(geoPosition.accuracy)} 米`,
      );
    }
    if (!locationTracking) locate();
  };

  const navigateToSelectedPlace = () => {
    if (!selectedPlace) return;
    if (calculateRoutes(selectedPlace.name)) {
      setSelectedPlaceId(null);
    }
  };

  const showPlannedRoute = (leg: PlanLeg, date: string) => {
    if (navigationSession) {
      setStudentTab('map');
      setNavigationSheetOpen(true);
      setNotice('正在导航中，结束后可开始下一段行程');
      return;
    }
    if (!leg.route) return;
    setStartInput(leg.from);
    setDestinationInput(leg.to);
    setDepartureTime(`${date}T${timeLabel(leg.departure)}`);
    setAudience('campus');
    setAlternatives([{ profile: 'fastest', route: leg.route }]);
    setActiveProfile('fastest');
    setSelectedPlaceId(null);
    setStudentTab('map');
    setNavigationSession({
      route: leg.route,
      destination: leg.to,
      origin: leg.from,
      followLocation: false,
      originLevelId: leg.route.geometry[0]?.levelId ?? currentLevelId,
    });
    if (!locationTracking) locate();
    navigationPanelRef.current
      ?.querySelectorAll('details')
      .forEach((details) => {
        details.open = false;
      });
    setNavigationSheetOpen(false);
    setCurrentLevelId(leg.route.geometry[0]?.levelId ?? currentLevelId);
    setNotice(
      `计划路线 · ${date} ${timeLabel(leg.departure)} 出发 · ${leg.from} → ${leg.to}`,
    );
    const point = leg.route.geometry[0];
    if (point) window.requestAnimationFrame(() => focusMapPoint(point));
  };

  const openRoutePreview = (
    legs: PlanLeg[],
    date: string,
    wholeDay = false,
  ) => {
    if (!legs.length) return;
    preview.open(legs, date, wholeDay);
    setSelectedPlaceId(null);
    setStudentTab('map');
    setZoom(APP_NAVIGATION_ZOOM);
  };
  const previewX = preview.point?.x;
  const previewY = preview.point?.y;
  const previewLevel = preview.point?.levelId;
  // Keep camera scrolling in the same paint as the marker update. Deferring it
  // by another frame makes the marker jump ahead and then snap back on screen.
  useLayoutEffect(() => {
    if (
      studentTab !== 'map' ||
      previewX === undefined ||
      previewY === undefined
    )
      return;
    focusMapPoint({ x: previewX, y: previewY }, 'instant', true);
  }, [studentTab, previewX, previewY, focusMapPoint]);
  useEffect(() => {
    if (studentTab !== 'map' || !previewLevel) return;
    const frame = window.requestAnimationFrame(() =>
      setCurrentLevelId(previewLevel),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [studentTab, previewLevel]);

  const endNavigation = () => {
    setNavigationSession(null);
    setAlternatives([]);
    setSelectedPlaceId(null);
    setNavigationSheetOpen(true);
    setNotice('导航已结束');
    window.requestAnimationFrame(() =>
      navigationHandleRef.current?.focus({ preventScroll: true }),
    );
  };

  const currentLinks = document.links.filter((link) => {
    const from = nodesById.get(link.from);
    const to = nodesById.get(link.to);
    return from?.levelId === currentLevelId || to?.levelId === currentLevelId;
  });
  const currentAreas = document.areas.filter(
    (area) => area.levelId === currentLevelId,
  );
  const currentNodes = document.nodes.filter(
    (node) => node.levelId === currentLevelId,
  );
  const geoLocalScale =
    geoPosition && mapCalibration
      ? mapCalibration.localScale(geoPosition)
      : null;
  const mapHeading =
    geoPosition && mapCalibration && deviceHeading?.trueHeading !== undefined
      ? headingOnMap(
          mapCalibration,
          geoPosition,
          deviceHeading.trueHeading,
          MAP_WIDTH,
          MAP_HEIGHT,
        )
      : null;
  const headingDegrees =
    deviceHeading?.trueHeading ?? deviceHeading?.magneticHeading;
  const headingStatusText =
    deviceHeading?.status === 'low' || deviceHeading?.status === 'unreliable'
      ? '请远离磁场干扰，转动手机校准'
      : deviceHeading?.status === 'tilted'
        ? '请稍放平手机查看朝向'
        : deviceHeading?.status === 'unavailable'
          ? '这台手机暂不支持指南针'
          : deviceHeading?.status === 'stale'
            ? '暂未获取朝向，请重新打开地图'
            : '正在获取朝向…';

  useEffect(() => {
    if (!appView || appFallbackCenteredRef.current) return;
    appFallbackCenteredRef.current = true;
    focusMapPoint({ x: 0.5, y: 0.5 }, 'auto');
  }, [appView, focusMapPoint]);

  return (
    <main
      className={`app-shell ${appView ? 'is-app-view' : ''}`}
      data-app-view={appView}
      data-navigation-active={Boolean(activeRoute)}
      data-navigation-session={Boolean(navigationSession)}
      data-route-preview={Boolean(preview.session)}
      data-navigation-sheet-open={navigationSheetOpen}
      data-place-selected={Boolean(selectedPlace)}
      data-student-tab={appView ? studentTab : undefined}
    >
      <header className="topbar" inert={appView && studentTab !== 'map'}>
        <div className="topbar-leading">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Navigation />
            </div>
            <div>
              <strong>{appView ? '南梨有梨' : '校园步行导航'}</strong>
              <span>
                {appView ? '江阴校区 · 校园导览' : 'NJUST · 混合通行网络 v2'}
              </span>
            </div>
          </div>
          <WeatherWidget
            state={weatherReport.state}
            onRetry={weatherReport.retry}
          />
        </div>
        {appView ? (
          <div className="app-view-heading" aria-label="当前模式">
            <Navigation />
            路线导航
          </div>
        ) : (
          <div className="mode-switch" aria-label="工作模式">
            <button
              className={`mode-button ${mode === 'annotate' ? 'is-active' : ''}`}
              onClick={() => setMode('annotate')}
            >
              <Waypoints />
              地图标注
            </button>
            <button
              className={`mode-button ${mode === 'navigate' ? 'is-active' : ''}`}
              onClick={() => {
                setMode('navigate');
                clearDraft();
              }}
            >
              <Navigation />
              路线导航
            </button>
          </div>
        )}
        <div className="header-actions">
          {!appView &&
            document.map.basemapRevision === REFINED_GUIDE_REVISION &&
            mapCalibration && (
              <Badge variant="outline">原图纠偏 · WGS-84 网格</Badge>
            )}
          {!appView && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload />
                导入
              </Button>
              <Button size="sm" onClick={exportDocument}>
                <Download />
                导出 JSON
              </Button>
              <input
                ref={importInputRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={importDocument}
              />
            </>
          )}
        </div>
      </header>

      <section className="workspace" inert={appView && studentTab !== 'map'}>
        <aside
          className="left-panel"
          ref={navigationPanelRef}
          id={appView ? 'app-navigation-sheet' : undefined}
        >
          {mode === 'annotate' ? (
            <>
              <div className="panel-section">
                <p className="section-label">绘制工具</p>
                <div className="tool-grid">
                  {TOOL_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className={`tool-button ${tool === item.id ? 'is-active' : ''}`}
                      title={item.hint}
                      onClick={() => chooseTool(item.id)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      <span
                        className="tool-count"
                        aria-label={`${item.label}数量`}
                      >
                        {toolCounts[item.id]}
                      </span>
                    </button>
                  ))}
                </div>
                {(draftPoints.length > 0 || activeNodeId) && (
                  <div className="draft-actions">
                    {draftPoints.length > 0 &&
                      tool !== 'path' &&
                      tool !== 'shadow' && (
                        <Button size="sm" onClick={finishDraft}>
                          <Save />
                          完成当前绘制
                        </Button>
                      )}
                    <Button size="sm" variant="outline" onClick={clearDraft}>
                      取消 / 结束
                    </Button>
                  </div>
                )}
              </div>

              {tool === 'shadow' && (
                <div className="panel-section compact-section shadow-fields">
                  <p className="section-label">
                    {redrawingShadowId ? '重画阴影矩形' : '矩形建筑阴影'}
                  </p>
                  <p className="helper-text">
                    依次点击矩形的两个对角。高度以米为单位，保存后自动计算太阳投影。
                  </p>
                  <label className="field-label" htmlFor="shadow-draft-height">
                    新建建筑高度（米）
                    <Input
                      type="number"
                      id="shadow-draft-height"
                      min="0"
                      step="any"
                      value={shadowHeight}
                      onChange={(event) => setShadowHeight(event.target.value)}
                    />
                  </label>
                  <Button
                    size="sm"
                    onClick={finishDraft}
                    disabled={draftPoints.length !== 2}
                  >
                    <Save />
                    保存阴影
                  </Button>
                  <a
                    className="helper-text"
                    href="/debug_sunshine"
                    target="_blank"
                    rel="noreferrer"
                  >
                    预览不同时刻的阴影 ↗
                  </a>
                </div>
              )}

              {tool === 'vertical' && (
                <div className="panel-section compact-section">
                  <p className="section-label">跨层参数</p>
                  <label className="field-label">
                    方式
                    <select
                      className="select-field"
                      value={verticalKind}
                      onChange={(event) =>
                        setVerticalKind(
                          event.target.value as typeof verticalKind,
                        )
                      }
                    >
                      <option value="stairs">楼梯</option>
                      <option value="elevator">电梯</option>
                      <option value="ramp">坡道</option>
                    </select>
                  </label>
                  <label className="field-label">
                    目标层
                    <select
                      className="select-field"
                      value={targetLevelId}
                      onChange={(event) => setTargetLevelId(event.target.value)}
                    >
                      <option value="">选择层级</option>
                      {document.levels
                        .filter((level) => level.id !== currentLevelId)
                        .map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="panel-section compact-section">
                <p className="section-label">层级管理</p>
                <label className="field-label">
                  当前层
                  <select
                    className="select-field"
                    value={currentLevelId}
                    onChange={(event) => {
                      setCurrentLevelId(event.target.value);
                      setSelection(null);
                      clearDraft();
                    }}
                  >
                    {document.levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name} · {level.elevationMeters}m
                      </option>
                    ))}
                  </select>
                </label>
                <div className="two-columns level-inputs">
                  <Input
                    value={newLevelName}
                    onChange={(event) => setNewLevelName(event.target.value)}
                    placeholder="新层名称"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    value={newLevelElevation}
                    onChange={(event) =>
                      setNewLevelElevation(event.target.value)
                    }
                    placeholder="高度 m"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={addLevel}>
                  <Layers3 />
                  添加层级
                </Button>
              </div>

              <div className="panel-section compact-section">
                <p className="section-label">真实距离</p>
                {mapCalibration ? (
                  <>
                    <p className="helper-text">
                      已按 WGS-84 /
                      本地米制逐段计算路线。原图横纵比例可不同，不再依赖单一米/像素值。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => chooseTool('calibration')}
                    >
                      <Crosshair />
                      查看校准质量
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="inline-field">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={metersPerPixel}
                        onChange={(event) =>
                          setMetersPerPixel(event.target.value)
                        }
                        placeholder="旧版米 / 像素"
                      />
                      <Button variant="outline" size="sm" onClick={updateScale}>
                        保存
                      </Button>
                    </div>
                    <p className="helper-text">
                      这是旧文件回退值；建议使用“地图校准”建立真实米制映射。
                    </p>
                  </>
                )}
              </div>

              <div className="panel-section stats-section">
                <dl className="stats-grid">
                  <div className="stat-card">
                    <dt>节点</dt>
                    <dd>{document.nodes.length}</dd>
                  </div>
                  <div className="stat-card">
                    <dt>通行段</dt>
                    <dd>{document.links.length}</dd>
                  </div>
                  <div className="stat-card">
                    <dt>通行面</dt>
                    <dd>{document.areas.length}</dd>
                  </div>
                  <div className="stat-card">
                    <dt>地点</dt>
                    <dd>{document.places.length}</dd>
                  </div>
                </dl>
                <p className="helper-text">
                  校准控制点 {calibrationAnchorCount}/3
                  {mapCalibration ? ' · 已按真实距离计算' : ' · 还需补充'}
                </p>
              </div>
            </>
          ) : appView ? (
            <div className="navigation-form app-navigation-form">
              <button
                type="button"
                ref={navigationHandleRef}
                className="app-sheet-grabber"
                aria-label="收起导航面板"
                title="向下拖动或点击收起"
              >
                <span className="app-sheet-handle" />
              </button>
              <div className="app-route-intro">
                <div>
                  <span className="app-route-kicker">
                    {navigationSession ? '正在导航' : '校园步行导航'}
                  </span>
                  <strong>
                    {activeRoute && destinationInput
                      ? `前往${destinationInput}`
                      : '想去哪里？'}
                  </strong>
                  <small>
                    {geoPosition
                      ? '已定位'
                      : locating || locationTracking
                        ? '正在定位…'
                        : '点击地图地点，或直接搜索目的地'}
                  </small>
                </div>
                <button
                  type="button"
                  className={`app-location-control ${geoPosition ? 'is-active' : ''}`}
                  onClick={recenterOnCurrentLocation}
                  aria-label={geoPosition ? '回到当前位置' : '获取当前位置'}
                  title={geoPosition ? '回到当前位置' : '获取当前位置'}
                >
                  <LocateFixed />
                </button>
              </div>

              <div className="app-destination-row">
                <div className="location-input destination">
                  <MapPin />
                  <Input
                    aria-label="目的地"
                    disabled={Boolean(navigationSession)}
                    list="app-place-options"
                    value={destinationInput}
                    onChange={(event) => {
                      setDestinationInput(event.target.value);
                      setSelectedPlaceId(null);
                      setAlternatives([]);
                    }}
                    placeholder="搜索教学楼、校门或服务点"
                  />
                </div>
                <Button
                  className="app-go-button"
                  onClick={() => calculateRoutes()}
                  disabled={
                    !destinationInput.trim() || Boolean(navigationSession)
                  }
                >
                  <ArrowRight />
                  {navigationSession ? '导航中' : '导航'}
                </Button>
              </div>

              <details className="app-route-settings">
                <summary>
                  <span>
                    <SlidersHorizontal />
                    路线与出发设置
                  </span>
                  <ChevronDown />
                </summary>
                <div className="app-route-settings-content">
                  <label className="field-label" htmlFor="app-origin">
                    起点
                    <div className="location-input">
                      <CircleDot />
                      <Input
                        id="app-origin"
                        disabled={Boolean(navigationSession)}
                        aria-label="起点"
                        list="app-place-options"
                        value={navigationSession?.origin ?? startInput}
                        onChange={(event) => {
                          setStartInput(event.target.value);
                          setAlternatives([]);
                        }}
                        placeholder="我的位置或校园地点"
                      />
                    </div>
                  </label>
                  <div className="app-route-settings-grid">
                    <label className="field-label" htmlFor="app-departure-time">
                      出发时间
                      <Input
                        id="app-departure-time"
                        disabled={Boolean(navigationSession)}
                        type="datetime-local"
                        value={departureTime}
                        onChange={(event) => {
                          setDepartureTime(event.target.value);
                          setAlternatives([]);
                        }}
                      />
                    </label>
                    <label className="field-label">
                      通行身份
                      <select
                        className="select-field"
                        disabled={Boolean(navigationSession)}
                        value={audience}
                        onChange={(event) => {
                          setAudience(event.target.value as typeof audience);
                          setAlternatives([]);
                        }}
                      >
                        <option value="campus">校内人员</option>
                        <option value="public">访客</option>
                      </select>
                    </label>
                  </div>
                </div>
              </details>

              <datalist id="app-place-options">
                {places.map((place) => (
                  <option key={place.id} value={place.name} label={place.name}>
                    {place.name}
                  </option>
                ))}
              </datalist>

              {alternatives.length > 0 && (
                <div className="app-profile-picker" aria-label="路线偏好">
                  {alternatives.map((alternative) => {
                    const meta = ROUTE_PROFILES.find(
                      (profile) => profile.id === alternative.profile,
                    );
                    return (
                      <button
                        key={alternative.profile}
                        type="button"
                        className={
                          activeProfile === alternative.profile
                            ? 'is-active'
                            : ''
                        }
                        disabled={!alternative.route}
                        onClick={() => {
                          setActiveProfile(alternative.profile);
                          if (navigationSession && alternative.route)
                            setNavigationSession({
                              ...navigationSession,
                              route: alternative.route,
                            });
                        }}
                      >
                        <span>{meta?.name}</span>
                        <small>
                          {alternative.route
                            ? routeTimeLabel(alternative.route)
                            : '不可达'}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeRoute && (
                <div className="app-route-result" aria-live="polite">
                  <span>
                    {
                      ROUTE_PROFILES.find((item) => item.id === activeProfile)
                        ?.name
                    }
                    路线
                  </span>
                  <strong>
                    {routeDistanceLabel(activeRoute)} ·{' '}
                    {routeTimeLabel(activeRoute)}
                  </strong>
                </div>
              )}

              {appNoticeText(notice) && (
                <output className="app-route-notice">
                  {appNoticeText(notice)}
                </output>
              )}
            </div>
          ) : (
            <div className="navigation-form">
              <div className="panel-section">
                <p className="section-label">从哪里出发</p>
                <div className="location-input">
                  <CircleDot />
                  <Input
                    list="place-options"
                    value={startInput}
                    onChange={(event) => {
                      setStartInput(event.target.value);
                      setAlternatives([]);
                    }}
                    placeholder="输入地点或使用定位"
                  />
                </div>
                <Button
                  variant="outline"
                  className="wide-button"
                  onClick={locate}
                  disabled={locating || locationTracking}
                >
                  <LocateFixed />
                  {locating
                    ? '正在等待精准定位…'
                    : locationTracking
                      ? '正在持续定位'
                      : '开始持续定位'}
                </Button>
              </div>
              <div className="panel-section">
                <p className="section-label">想去哪里</p>
                <div className="location-input destination">
                  <MapPin />
                  <Input
                    list="place-options"
                    value={destinationInput}
                    onChange={(event) => {
                      setDestinationInput(event.target.value);
                      setAlternatives([]);
                    }}
                    placeholder="输入目的地名称"
                  />
                </div>
              </div>
              <div className="panel-section compact-section">
                <div className="navigation-conditions">
                  <label className="field-label" htmlFor="departure-time">
                    出发时间
                    <Input
                      id="departure-time"
                      type="datetime-local"
                      value={departureTime}
                      onChange={(event) => {
                        setDepartureTime(event.target.value);
                        setAlternatives([]);
                      }}
                    />
                  </label>
                  <label className="field-label">
                    通行身份
                    <select
                      className="select-field"
                      value={audience}
                      onChange={(event) =>
                        setAudience(event.target.value as typeof audience)
                      }
                    >
                      <option value="campus">校内人员</option>
                      <option value="public">访客</option>
                    </select>
                  </label>
                </div>
                {sunlightContext && (
                  <output
                    className={`sunlight-preview ${sunlightContext.status === 'active' ? 'is-active' : ''}`}
                  >
                    {sunlightContext.status === 'active'
                      ? `晴天投影已启用 · 太阳高度 ${sunlightContext.position.elevationDegrees.toFixed(1)}° · 方位 ${sunlightContext.position.azimuthDegrees.toFixed(1)}°`
                      : sunlightInactiveLabel(sunlightContext.reason)}
                  </output>
                )}
                <Button
                  className="wide-button route-button"
                  onClick={() => calculateRoutes()}
                >
                  <Sparkles />
                  {appView ? '开始导航' : '计算全部路线方案'}
                </Button>
              </div>
              <datalist id="place-options">
                {places.map((place) => (
                  <option key={place.id} value={place.name} label={place.name}>
                    {place.name}
                  </option>
                ))}
              </datalist>
              {alternatives.length > 0 && (
                <div className="route-options">
                  <p className="section-label">方案对比</p>
                  {alternatives.map((alternative) => {
                    const meta = ROUTE_PROFILES.find(
                      (profile) => profile.id === alternative.profile,
                    );
                    return (
                      <button
                        key={alternative.profile}
                        className={`route-card ${activeProfile === alternative.profile ? 'is-active' : ''} ${!alternative.route ? 'is-unavailable' : ''}`}
                        disabled={!alternative.route}
                        onClick={() => setActiveProfile(alternative.profile)}
                      >
                        <span>
                          <strong>{meta?.name}</strong>
                          <small>{meta?.detail}</small>
                        </span>
                        {alternative.route ? (
                          <span className="route-card-metrics">
                            <b>{routeDistanceLabel(alternative.route)}</b>
                            <small>{routeTimeLabel(alternative.route)}</small>
                          </span>
                        ) : (
                          <Badge variant="outline">不可达</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeRoute && (
                <div className="route-summary">
                  <strong>
                    {
                      ROUTE_PROFILES.find((item) => item.id === activeProfile)
                        ?.name
                    }
                    路线
                  </strong>
                  <span>
                    {routeDistanceLabel(activeRoute)} ·{' '}
                    {routeTimeLabel(activeRoute)}
                  </span>
                  {activeRoute.metrics.sunlight?.status === 'active' ? (
                    <span className="sunlight-status">
                      晴 ·{' '}
                      {activeRoute.metrics.sunlight.weatherSource === 'hourly'
                        ? '小时预报'
                        : '当前实况'}{' '}
                      {campusTimeLabel(activeRoute.metrics.sunlight.weatherAt)}{' '}
                      · 太阳高度{' '}
                      {activeRoute.metrics.sunlight.elevationDegrees.toFixed(1)}
                      ° · 方位{' '}
                      {activeRoute.metrics.sunlight.azimuthDegrees.toFixed(1)}°
                    </span>
                  ) : activeRoute.metrics.sunlight ? (
                    <span className="sunlight-status">
                      {sunlightInactiveLabel(
                        activeRoute.metrics.sunlight.reason,
                      )}
                    </span>
                  ) : null}
                  <div className="comfort-bars">
                    {activeRoute.metrics.sunlight?.status === 'active' && (
                      <>
                        <span>
                          建筑阴影{' '}
                          {Math.round(
                            (activeRoute.metrics.sunlight.buildingShadowPixels /
                              Math.max(
                                activeRoute.metrics.sunlight.outdoorPixels,
                                1,
                              )) *
                              100,
                          )}
                          %
                        </span>
                        <span>
                          直晒{' '}
                          {sunlightDistanceLabel(
                            activeRoute.metrics.sunlight.directSunMeters,
                            activeRoute.metrics.sunlight.directSunPixels,
                          )}
                        </span>
                      </>
                    )}
                    <span>
                      室内{' '}
                      {Math.round(
                        (activeRoute.metrics.indoorPixels /
                          Math.max(activeRoute.metrics.distancePixels, 1)) *
                          100,
                      )}
                      %
                    </span>
                    <span>跨层 {activeRoute.metrics.levelChanges} 次</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="map-column">
          {deviceHeading && (
            <div className="app-heading-readout" aria-label="手机朝向">
              <Compass size={20} aria-hidden="true" />
              <span>
                {headingDegrees === undefined
                  ? headingStatusText
                  : `朝向${headingLabel(headingDegrees)}`}
                {headingDegrees !== undefined &&
                  (deviceHeading.status === 'low' ||
                    deviceHeading.trueHeading === undefined) && (
                    <small>
                      {deviceHeading.status === 'low'
                        ? headingStatusText
                        : '磁北方向 · 定位后校正'}
                    </small>
                  )}
              </span>
            </div>
          )}
          <div className="map-toolbar">
            <div className="level-tabs">
              {document.levels.map((level) => (
                <button
                  key={level.id}
                  className={level.id === currentLevelId ? 'is-active' : ''}
                  onClick={() => setCurrentLevelId(level.id)}
                >
                  {level.name}
                </button>
              ))}
            </div>
            <div className="zoom-controls">
              {appView && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="map-location-button"
                  onClick={recenterOnCurrentLocation}
                  aria-label={geoPosition ? '回到当前位置' : '获取当前位置'}
                  title={geoPosition ? '回到当前位置' : '获取当前位置'}
                >
                  <LocateFixed />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="缩小地图"
                title="缩小地图"
                onClick={() =>
                  setZoom((value) => Math.max(0.7, value - ZOOM_STEP))
                }
              >
                <ZoomOut />
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="放大地图"
                title="放大地图"
                onClick={() =>
                  setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))
                }
              >
                <ZoomIn />
              </Button>
              {mode === 'annotate' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={!historyCount}
                >
                  <Undo2 />
                  撤销
                </Button>
              )}
            </div>
          </div>
          <div ref={mapScrollRef} className="map-scroll">
            <div
              ref={mapStageRef}
              className="map-stage"
              style={{ width: `${zoom * 100}%` }}
            >
              <svg
                ref={mapSvgRef}
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                role="application"
                tabIndex={0}
                aria-label={`${currentLevel?.name ?? ''}校园通行地图`}
                onClick={handleMapClick}
                onMouseMove={(event) => {
                  if (tool === 'shadow' && draftPoints.length === 1)
                    setShadowCursor(mapPointFromEvent(event));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') clearDraft();
                }}
              >
                <image
                  href={`/${document.map.image}`}
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  preserveAspectRatio="none"
                />
                {currentLevelId === DEFAULT_LEVEL.id &&
                  sunlightContext?.status === 'active' && (
                    <g
                      className="solar-shadow-layer"
                      aria-label={`晴天建筑阴影，太阳高度 ${sunlightContext.position.elevationDegrees.toFixed(1)} 度，方位 ${sunlightContext.position.azimuthDegrees.toFixed(1)} 度`}
                    >
                      <g className="solar-cast-shadows">
                        {sunlightContext.shadowPolygons.map((shadow) => (
                          <polygon
                            key={shadow.buildingId}
                            points={pointsAttribute(shadow.boundary)}
                          />
                        ))}
                      </g>
                    </g>
                  )}
                {mode === 'annotate' && currentLevelId === DEFAULT_LEVEL.id && (
                  <g
                    className="solar-building-footprints shadow-edit-layer"
                    aria-label="自定义阴影建筑"
                  >
                    {(document.solarBuildings ?? []).map((building) => (
                      <polygon
                        key={building.id}
                        points={pointsAttribute(building.footprint)}
                        className={
                          selectedShadow?.id === building.id
                            ? 'is-selected'
                            : ''
                        }
                      >
                        <title>
                          {building.name} · {building.heightMeters} 米
                        </title>
                      </polygon>
                    ))}
                    {shadowDraft.length > 0 && (
                      <polygon
                        className="is-draft"
                        points={pointsAttribute(shadowDraft)}
                      />
                    )}
                  </g>
                )}
                {mode === 'annotate' && tool === 'calibration' && (
                  <g className="calibration-anchors" aria-hidden="true">
                    {document.map.calibration?.anchors.map((anchor, index) => (
                      <g
                        key={anchor.id}
                        transform={`translate(${anchor.image.x * MAP_WIDTH} ${anchor.image.y * MAP_HEIGHT})`}
                      >
                        <circle r="13" />
                        <path d="M -20 0 H 20 M 0 -20 V 20" />
                        <text x="18" y="-18">
                          {anchor.label || `控制点 ${index + 1}`}
                        </text>
                      </g>
                    ))}
                    {calibrationDraft && (
                      <g
                        className="is-draft"
                        transform={`translate(${calibrationDraft.x * MAP_WIDTH} ${calibrationDraft.y * MAP_HEIGHT})`}
                      >
                        <circle r="16" />
                        <path d="M -24 0 H 24 M 0 -24 V 24" />
                        <text x="22" y="-22">
                          待配对
                        </text>
                      </g>
                    )}
                  </g>
                )}
                {!appView && (
                  <g className="walkable-areas">
                    {currentAreas.map((area) => (
                      <g
                        key={area.id}
                        className={
                          selection?.type === 'area' && selection.id === area.id
                            ? 'is-selected'
                            : ''
                        }
                      >
                        <polygon
                          className={`area-fill ${area.environment.setting}`}
                          points={pointsAttribute(area.boundary)}
                        />
                        {area.obstacles.map((obstacle) => (
                          <polygon
                            key={obstacle.id}
                            className="area-obstacle"
                            points={pointsAttribute(obstacle.boundary)}
                          />
                        ))}
                        <polyline
                          className="area-border"
                          points={`${pointsAttribute(area.boundary)} ${area.boundary[0].x * MAP_WIDTH},${area.boundary[0].y * MAP_HEIGHT}`}
                        />
                        <text
                          className="area-name"
                          x={averagePoint(area.boundary).x * MAP_WIDTH}
                          y={averagePoint(area.boundary).y * MAP_HEIGHT}
                        >
                          {area.name || '通行面'}
                        </text>
                      </g>
                    ))}
                  </g>
                )}
                {!appView && (
                  <g
                    className={`traversal-links ${mode === 'navigate' && activeRoute ? 'is-muted' : ''}`}
                  >
                    {currentLinks.map((link) => {
                      const from = nodesById.get(link.from);
                      const to = nodesById.get(link.to);
                      const sameLevel =
                        from?.levelId === currentLevelId &&
                        to?.levelId === currentLevelId;
                      return sameLevel ? (
                        <polyline
                          key={link.id}
                          className={`${link.kind} ${selection?.type === 'link' && selection.id === link.id ? 'is-selected' : ''} ${link.access.temporarilyClosed ? 'is-closed' : ''}`}
                          points={pointsAttribute(link.geometry)}
                        />
                      ) : (
                        <circle
                          key={link.id}
                          className={`vertical-link ${link.kind}`}
                          cx={
                            (from?.levelId === currentLevelId
                              ? from.x
                              : (to?.x ?? 0)) * MAP_WIDTH
                          }
                          cy={
                            (from?.levelId === currentLevelId
                              ? from.y
                              : (to?.y ?? 0)) * MAP_HEIGHT
                          }
                          r="13"
                        />
                      );
                    })}
                  </g>
                )}
                {preview.session?.wholeDay && (
                  <g className="preview-day-routes" aria-hidden="true">
                    {preview.session.legs.flatMap((leg) =>
                      splitRouteByLevel(
                        leg.route?.geometry ?? [],
                        currentLevelId,
                      ).map((segment, index) => (
                        <polyline
                          key={`${leg.id}-${index}`}
                          points={pointsAttribute(segment)}
                        />
                      )),
                    )}
                  </g>
                )}
                {routeSegments.length > 0 && (
                  <g className="active-route">
                    {routeSegments.map((segment, index) => (
                      <g key={index}>
                        <polyline
                          className="route-outline"
                          points={pointsAttribute(segment)}
                        />
                        <polyline
                          className="route-line"
                          points={pointsAttribute(segment)}
                        />
                      </g>
                    ))}
                  </g>
                )}
                {draftPoints.length > 0 && tool !== 'shadow' && (
                  <g className="draft-geometry">
                    {tool === 'area' || tool === 'obstacle' ? (
                      <polygon points={pointsAttribute(draftPoints)} />
                    ) : (
                      <polyline points={pointsAttribute(draftPoints)} />
                    )}
                    {draftPoints.map((point, index) => (
                      <circle
                        key={index}
                        cx={point.x * MAP_WIDTH}
                        cy={point.y * MAP_HEIGHT}
                        r="8"
                      />
                    ))}
                  </g>
                )}
                {mode === 'annotate' && (
                  <g className="geometry-handles" aria-hidden="true">
                    {currentAreas.map((area) => (
                      <g
                        key={`handles-${area.id}`}
                        className={
                          selection?.type === 'area' && selection.id === area.id
                            ? 'is-selected'
                            : ''
                        }
                      >
                        {area.boundary.map((point, index) => (
                          <rect
                            key={`area-${index}`}
                            className="area-vertex"
                            x={point.x * MAP_WIDTH - 6}
                            y={point.y * MAP_HEIGHT - 6}
                            width="12"
                            height="12"
                            rx="2"
                          />
                        ))}
                        {area.obstacles.flatMap((obstacle) =>
                          obstacle.boundary.map((point, index) => (
                            <circle
                              key={`${obstacle.id}-${index}`}
                              className="obstacle-vertex"
                              cx={point.x * MAP_WIDTH}
                              cy={point.y * MAP_HEIGHT}
                              r="6"
                            />
                          )),
                        )}
                      </g>
                    ))}
                    {currentLinks.flatMap((link) => {
                      const from = nodesById.get(link.from);
                      const to = nodesById.get(link.to);
                      if (
                        from?.levelId !== currentLevelId ||
                        to?.levelId !== currentLevelId
                      ) {
                        return [];
                      }
                      return link.geometry
                        .slice(1, -1)
                        .map((point, index) => (
                          <circle
                            key={`${link.id}-control-${index}`}
                            className={`curve-control ${link.kind} ${selection?.type === 'link' && selection.id === link.id ? 'is-selected' : ''}`}
                            cx={point.x * MAP_WIDTH}
                            cy={point.y * MAP_HEIGHT}
                            r="6"
                          />
                        ));
                    })}
                  </g>
                )}
                {mode === 'annotate' && (
                  <g className="traversal-nodes">
                    {currentNodes.map((node) => {
                      const className = `${node.kind} ${selection?.type === 'node' && selection.id === node.id ? 'is-selected' : ''} ${activeNodeId === node.id ? 'is-active' : ''}`;
                      return node.kind === 'portal' ? (
                        <rect
                          key={node.id}
                          className={className}
                          x={node.x * MAP_WIDTH - 8}
                          y={node.y * MAP_HEIGHT - 8}
                          width="16"
                          height="16"
                          rx="2"
                          transform={`rotate(45 ${node.x * MAP_WIDTH} ${node.y * MAP_HEIGHT})`}
                        />
                      ) : (
                        <circle
                          key={node.id}
                          className={className}
                          cx={node.x * MAP_WIDTH}
                          cy={node.y * MAP_HEIGHT}
                          r="7"
                        />
                      );
                    })}
                  </g>
                )}
                <g className="place-labels">
                  {places.map((place) => {
                    const node = nodesById.get(place.nodeId);
                    if (!node || node.levelId !== currentLevelId) return null;
                    return (
                      <g
                        key={place.id}
                        className={`place-label ${appView ? 'is-interactive' : ''} ${selectedPlaceId === place.id ? 'is-selected' : ''}`}
                        transform={`translate(${node.x * MAP_WIDTH} ${node.y * MAP_HEIGHT})`}
                        role={appView ? 'button' : undefined}
                        tabIndex={appView ? 0 : undefined}
                        aria-label={
                          appView ? `${place.name}，查看地点操作` : undefined
                        }
                        onClick={(event) => {
                          if (!appView) return;
                          event.stopPropagation();
                          selectAppPlace(place.id);
                        }}
                        onKeyDown={(event) => {
                          if (
                            appView &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            selectAppPlace(place.id);
                          }
                        }}
                      >
                        {appView && (
                          <circle className="place-label-hit" r="28" />
                        )}
                        <circle r="10" />
                        {!appView && (
                          <text x="17" y="-14">
                            {place.name}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
                {geoPosition && (
                  <g className="geo-marker">
                    {mapHeading !== null && (
                      <g
                        className="geo-heading"
                        aria-label={`手机朝向${headingLabel(deviceHeading!.trueHeading!)}`}
                        transform={`translate(${geoPosition.x * MAP_WIDTH} ${geoPosition.y * MAP_HEIGHT}) rotate(${mapHeading})`}
                      >
                        <path
                          className="geo-heading-cone"
                          d="M 0 0 L -29 -51 A 59 59 0 0 1 29 -51 Z"
                        />
                        <path
                          className="geo-heading-arrow"
                          d="M 0 -29 L 9 -14 L 0 -18 L -9 -14 Z"
                        />
                      </g>
                    )}
                    <ellipse
                      className="geo-accuracy"
                      cx={geoPosition.x * MAP_WIDTH}
                      cy={geoPosition.y * MAP_HEIGHT}
                      rx={Math.max(
                        20,
                        geoPosition.accuracy /
                          Math.max(
                            geoLocalScale?.xMetersPerPixel ??
                              document.map.metersPerPixel ??
                              1,
                            0.01,
                          ),
                      )}
                      ry={Math.max(
                        20,
                        geoPosition.accuracy /
                          Math.max(
                            geoLocalScale?.yMetersPerPixel ??
                              document.map.metersPerPixel ??
                              1,
                            0.01,
                          ),
                      )}
                    />
                    <circle
                      className="geo-ring"
                      cx={geoPosition.x * MAP_WIDTH}
                      cy={geoPosition.y * MAP_HEIGHT}
                      r="13"
                    />
                    <circle
                      className="geo-dot"
                      cx={geoPosition.x * MAP_WIDTH}
                      cy={geoPosition.y * MAP_HEIGHT}
                      r="5"
                    />
                  </g>
                )}
                {preview.point?.levelId === currentLevelId && (
                  <g className="preview-walker" aria-label="预览行进位置">
                    <circle
                      cx={preview.point.x * MAP_WIDTH}
                      cy={preview.point.y * MAP_HEIGHT}
                      r="13"
                    />
                  </g>
                )}
              </svg>
            </div>
          </div>
          {appView && selectedPlace && selectedPlaceNode && (
            <section
              className="place-action-sheet"
              aria-live="polite"
              aria-label={`${selectedPlace.name}地点操作`}
            >
              <span className="app-sheet-handle" aria-hidden="true" />
              <div className="place-action-heading">
                <span className="place-action-icon" aria-hidden="true">
                  <MapPin />
                </span>
                <div>
                  <small>已选择校园地点</small>
                  <strong>{selectedPlace.name}</strong>
                  <span>
                    {document.levels.find(
                      (level) => level.id === selectedPlaceNode.levelId,
                    )?.name ?? '校园地图'}
                    {geoPosition ? ' · 从当前位置出发' : ' · 等待当前位置'}
                  </span>
                </div>
                <button
                  type="button"
                  className="place-action-close"
                  onClick={() => setSelectedPlaceId(null)}
                  aria-label="关闭地点操作"
                  title="关闭"
                >
                  <ChevronDown />
                </button>
              </div>
              <Button
                className="place-go-button"
                onClick={navigateToSelectedPlace}
              >
                <Navigation />
                去这里
                <ArrowRight />
              </Button>
            </section>
          )}
          <div className="statusbar">
            <span>
              <Crosshair />
              {notice ||
                (mode === 'annotate'
                  ? TOOL_ITEMS.find((item) => item.id === tool)?.hint
                  : activeRoute
                    ? `正在显示${ROUTE_PROFILES.find((item) => item.id === activeProfile)?.name}路线`
                    : '输入起点和目的地开始导航')}
            </span>
            <span className="save-state">
              <Save />
              {persistenceState === 'enabled'
                ? '已自动保存到本机'
                : persistenceState === 'paused'
                  ? '自动保存已暂停，请先导出备份'
                  : '正在读取数据'}
            </span>
          </div>
        </div>

        <aside className="right-panel">
          {mode === 'annotate' ? (
            <>
              <div className="panel-section inspector-header">
                <div>
                  <p className="section-label">属性检查器</p>
                  <strong>
                    {tool === 'calibration'
                      ? '地图校准'
                      : selectedShadow
                        ? '建筑阴影'
                        : selectedNode
                          ? '节点与地点'
                          : selectedLink
                            ? '通行段'
                            : selectedArea
                              ? '通行面'
                              : '未选择要素'}
                  </strong>
                </div>
                {selection && tool !== 'calibration' && (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={removeSelection}
                    aria-label="删除所选要素"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <div className="panel-section inspector-content">
                {tool === 'calibration' ? (
                  <CalibrationInspector
                    key={
                      document.map.calibration?.reference.sourceUrl ?? 'empty'
                    }
                    document={document}
                    draft={calibrationDraft}
                    built={mapCalibration}
                    onCommit={commit}
                    onApplyReference={applyReferenceCalibration}
                    onNotice={setNotice}
                  />
                ) : selectedShadow ? (
                  <ShadowInspector
                    key={JSON.stringify(selectedShadow)}
                    building={selectedShadow}
                    onSave={(building) =>
                      commit(
                        {
                          ...document,
                          solarBuildings: (document.solarBuildings ?? []).map(
                            (item) =>
                              item.id === building.id ? building : item,
                          ),
                        },
                        '已更新建筑阴影',
                      )
                    }
                    onRedraw={() => {
                      clearDraft();
                      setRedrawingShadowId(selectedShadow.id);
                      setShadowHeight(String(selectedShadow.heightMeters));
                      setTool('shadow');
                      setCurrentLevelId(DEFAULT_LEVEL.id);
                      setNotice('点击两个对角重画矩形，保存后替换原轮廓');
                    }}
                  />
                ) : selectedNode ? (
                  <NodeInspector
                    key={selectedNode.id}
                    node={selectedNode}
                    document={document}
                    onChange={setDocument}
                  />
                ) : selectedLink ? (
                  <LinkInspector
                    link={selectedLink}
                    document={document}
                    onChange={setDocument}
                  />
                ) : selectedArea ? (
                  <AreaInspector
                    area={selectedArea}
                    document={document}
                    onChange={setDocument}
                  />
                ) : (
                  <div className="empty-inspector">
                    <MousePointer2 />
                    <p>
                      使用“选择”工具点击节点、路径或区域，即可编辑通行属性。
                    </p>
                  </div>
                )}
              </div>
              <div className="panel-section diagnostics">
                <div className="diagnostic-title">
                  <ShieldAlert />
                  <span>网络检查</span>
                  <Badge
                    variant={
                      diagnostics.some((item) => item.severity === 'error')
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {diagnostics.length}
                  </Badge>
                </div>
                {diagnostics.length === 0 ? (
                  <p className="helper-text">未发现结构问题</p>
                ) : (
                  diagnostics.slice(0, 8).map((item, index) => (
                    <button
                      key={`${item.featureId}-${index}`}
                      onClick={() => {
                        if (
                          document.links.some(
                            (link) => link.id === item.featureId,
                          )
                        )
                          setSelection({
                            type: 'link',
                            id: item.featureId as string,
                          });
                        else if (
                          document.areas.some(
                            (area) => area.id === item.featureId,
                          )
                        )
                          setSelection({
                            type: 'area',
                            id: item.featureId as string,
                          });
                      }}
                    >
                      <span className={item.severity}>
                        {item.severity === 'error' ? '错误' : '提醒'}
                      </span>
                      {item.message}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="guide-panel">
              <div className="guide-icon">
                <Navigation />
              </div>
              <h2>路线会随条件变化</h2>
              <p>
                系统不只比较距离，还会在出发时刻检查教学楼开放时间、通行身份、临时关闭和无障碍条件。
              </p>
              <ul>
                <li>
                  <Accessibility />
                  无障碍路线会排除楼梯
                </li>
                <li>
                  <Building2 />
                  晴天少晒路线按建筑投影阴影计算
                </li>
                <li>
                  <ChevronDown />
                  跨层路线可切换上方层级查看
                </li>
              </ul>
              {diagnostics.some((item) => item.severity === 'error') && (
                <div className="warning-box">
                  <ShieldAlert />
                  标注网络仍有错误，部分路线可能不可达。
                </div>
              )}
            </div>
          )}
        </aside>
      </section>
      {appView &&
        studentTab === 'map' &&
        !preview.session &&
        !selectedPlace &&
        (navigationSession || !navigationSheetOpen) && (
          <div
            className="app-navigation-dock"
            aria-label={navigationSession ? '当前导航' : '导航入口'}
          >
            <button
              type="button"
              ref={navigationResumeRef}
              className="app-navigation-resume"
              aria-label={navigationSheetOpen ? '收起导航面板' : '展开导航面板'}
              aria-expanded={navigationSheetOpen}
              aria-controls="app-navigation-sheet"
              onClick={() => {
                setNavigationSheetOpen(!navigationSheetOpen);
                if (!navigationSheetOpen)
                  window.requestAnimationFrame(() =>
                    navigationHandleRef.current?.focus({ preventScroll: true }),
                  );
              }}
            >
              <Navigation size={22} />
              <span>
                <strong>
                  {navigationSession
                    ? `前往${navigationSession.destination}`
                    : '想去哪里？'}
                </strong>
                <small>
                  {navigationSession
                    ? `${routeDistanceLabel(navigationSession.route)} · ${routeTimeLabel(navigationSession.route)}`
                    : '展开导航'}
                </small>
              </span>
              <ChevronDown
                size={18}
                className={navigationSheetOpen ? '' : 'is-collapsed'}
              />
            </button>
            {navigationSession && (
              <button
                type="button"
                className="app-navigation-end"
                onClick={endNavigation}
              >
                结束
              </button>
            )}
          </div>
        )}
      {appView && studentTab === 'map' && preview.session && (
        <RoutePreviewControls
          preview={preview}
          onClose={() => {
            preview.close();
            setStudentTab('today');
          }}
        />
      )}
      {appView && (
        <StudentHub
          tab={studentTab}
          onTabChange={setStudentTab}
          places={places}
          navigator={campusNavigator}
          onNavigate={(leg, date) => {
            preview.close();
            showPlannedRoute(leg, date);
          }}
          onPreview={(leg, date) => openRoutePreview([leg], date)}
          onPreviewDay={(plan, date) =>
            openRoutePreview(dailyPreviewLegs(plan), date, true)
          }
        />
      )}
    </main>
  );
}
