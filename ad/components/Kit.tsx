/** @jsxRuntime classic */
/** @jsx React.createElement */
import { React } from '@fourier-video/sdk';
import {
  FourierMotion,
  motion,
  type ReactNode,
  type CSSProperties,
} from '@fourier-video/sdk';
import sf from '../assets/fonts/SF.woff';
import heiti from '../assets/fonts/Heiti.woff';
import mont from '../assets/fonts/Montserrat.woff';
import map from '../assets/map.jpg';
import campus from '../assets/campus.json';
export { motion, campus };
export const C = {
  paper: '#f5f5f7',
  ink: '#1d1d1f',
  muted: '#86868b',
  silver: '#dedfe3',
  blue: '#3475ba',
  green: '#4c796a',
  pale: '#c8dace',
  peach: '#e9b69c',
  navy: '#18232d',
};
export const ease = [0.22, 1, 0.36, 1] as const;
export const full: CSSProperties = { position: 'absolute', inset: 0 };
export function Frame({
  children,
  bg = C.paper,
  note,
}: {
  children: ReactNode;
  bg?: string;
  note?: string;
}) {
  return (
    <FourierMotion>
      <div
        style={{
          width: 1920,
          height: 1080,
          position: 'relative',
          overflow: 'hidden',
          background: bg,
          color: C.ink,
          fontFamily: 'SF,Heiti,sans-serif',
          letterSpacing: '-.035em',
        }}
      >
        <style>{`@font-face{font-family:SF;src:url('${sf}')}@font-face{font-family:Heiti;src:url('${heiti}')}@font-face{font-family:Mont;src:url('${mont}')}*{box-sizing:border-box}`}</style>
        {children}
        {note && (
          <div
            style={{
              position: 'absolute',
              left: 90,
              bottom: 38,
              fontSize: 21,
              color: bg === C.navy ? '#aab5bd' : C.muted,
              letterSpacing: 0,
            }}
          >
            {note}
          </div>
        )}
      </div>
    </FourierMotion>
  );
}
export function Reveal({
  children,
  x = 0,
  y = 0,
  delay = 0,
  style = {},
}: {
  children: ReactNode;
  x?: number;
  y?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      style={{ position: 'absolute', left: x, top: y, ...style }}
      animate={[
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)' },
      ]}
      transition={{ duration: 0.65, delay, ease, fill: 'both' }}
    >
      {children}
    </motion.div>
  );
}
export function Label({
  children,
  x,
  y,
  size = 56,
  color = C.ink,
  delay = 0,
}: {
  children: ReactNode;
  x: number;
  y: number;
  size?: number;
  color?: string;
  delay?: number;
}) {
  return (
    <Reveal
      x={x}
      y={y}
      delay={delay}
      style={{ fontSize: size, fontWeight: 550, lineHeight: 1.1, color }}
    >
      {children}
    </Reveal>
  );
}
export function Ink({
  d,
  color = C.ink,
  width = 7,
  delay = 0,
  duration = 1.2,
}: {
  d: string;
  color?: string;
  width?: number;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray="1"
      animate={[{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }]}
      transition={{ duration, delay, ease: 'linear', fill: 'both' }}
    />
  );
}
export function Dot({
  x = 0,
  y = 0,
  size = 30,
  color = C.blue,
}: {
  x?: number;
  y?: number;
  size?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        border: '5px solid white',
        boxShadow: '0 2px 16px #18232d25',
      }}
    />
  );
}
export function Pin({
  x = 0,
  y = 0,
  name,
  delay = 0,
  color = C.blue,
}: {
  x?: number;
  y?: number;
  name?: string;
  delay?: number;
  color?: string;
}) {
  return (
    <motion.div
      style={{ position: 'absolute', left: x, top: y }}
      animate={[
        { opacity: 0, y: -45, scale: 0.6 },
        { opacity: 1, y: 0, scale: 1 },
      ]}
      transition={{ duration: 0.6, delay, ease, fill: 'both' }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          background: color,
          borderRadius: '50% 50% 50% 5px',
          transform: 'translate(-50%,-105%) rotate(-45deg)',
          border: '4px solid white',
          boxShadow: '-3px 5px 15px #2222',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'white',
            margin: 13,
          }}
        />
      </div>
      {name && (
        <span
          style={{
            position: 'absolute',
            top: 13,
            left: 0,
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontSize: 30,
            padding: '8px 15px',
            background: '#fffffff2',
            borderRadius: 14,
            boxShadow: '0 5px 20px #0000000a',
          }}
        >
          {name}
        </span>
      )}
    </motion.div>
  );
}
export function MapArt({
  photo = false,
  route = -1,
  draw = false,
  labels = false,
  dark = false,
}: {
  photo?: boolean;
  route?: number;
  draw?: boolean;
  labels?: boolean;
  dark?: boolean;
}) {
  const line = campus.routes[route];
  return (
    <div
      style={{
        width: 2038,
        height: 1279,
        position: 'relative',
        background: dark ? C.navy : '#eeefec',
      }}
    >
      {photo ? (
        <img
          src={map}
          style={{
            ...full,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'saturate(.65) contrast(.98)',
          }}
        />
      ) : (
        <svg viewBox="0 0 2038 1279" style={full}>
          <path
            d="M343.27 705.41 L517.2 682.88 L678.42 637.68 L849.75 600.74 L1028 587.77 L1194.54 573.82 L1373.74 539.14 L1565.04 513.87 L1746.9 494.81 L1859.17 484.28"
            fill="none"
            stroke={dark ? '#304451' : '#ccdce1'}
            strokeWidth={54}
          />
          <path
            d="M674.89 730.55 L730.3 666.85 L833.04 617.93 L929.82 608.89 L993.24 635.43 L1047.41 629.59 L1127.72 600.37 L1202.85 627.9 L1254.66 698.04 L1265.28 802.7 L1235.18 867.14 L1142.28 876.11 L1067.3 894.38 L981.06 879.12 L879.91 835.2 L787.47 811.62 L729.38 774.13 L674.89 730.55 Z"
            fill={dark ? '#304451' : '#ccdce1'}
          />
          {campus.roads.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={dark ? '#52616b' : '#ffffff'}
              strokeWidth={15}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {campus.buildings.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={dark ? '#6b7a84' : i % 7 === 0 ? '#bfd0c5' : '#d0d3d0'}
              stroke={dark ? '#96a1a6' : '#b4bab5'}
              strokeWidth={1.8}
            />
          ))}
        </svg>
      )}
      {line && (
        <svg style={{ ...full, overflow: 'visible' }} viewBox="0 0 2038 1279">
          <path
            d={line.path}
            fill="none"
            stroke="white"
            strokeWidth={23}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {draw ? (
            <Ink
              d={line.path}
              color={C.blue}
              width={13}
              delay={0.3}
              duration={1.6}
            />
          ) : (
            <path
              d={line.path}
              fill="none"
              stroke={C.blue}
              strokeWidth={13}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
      {labels &&
        ['图书馆', '致远楼A', '樱花苑食堂', '体育场'].map((n, i) => {
          const p = campus.places.find((p) => p.name === n)!;
          return <Pin key={n} x={p.x} y={p.y} name={n} delay={0.2 + i * 0.1} />;
        })}
    </div>
  );
}
export function Phone({
  children,
  scale = 1,
}: {
  children: ReactNode;
  scale?: number;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: 444,
        height: 896,
        padding: 12,
        borderRadius: 70,
        background:
          'linear-gradient(115deg,#fafafa,#a5a8ad 25%,#f4f5f6 48%,#81858b)',
        boxShadow: '0 45px 65px -35px #18232d60, inset 0 0 0 2px #acafb4',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
          borderRadius: 59,
          background: C.paper,
          border: '5px solid #1d1d1f',
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            top: 15,
            left: 145,
            width: 120,
            height: 32,
            borderRadius: 30,
            background: '#161618',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 27,
            fontSize: 19,
            fontWeight: 600,
          }}
        >
          9:41
        </div>
        <div style={{ position: 'absolute', top: 22, right: 26, fontSize: 16 }}>
          ▮▮▮ ▰
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 9,
            left: 148,
            width: 120,
            height: 5,
            borderRadius: 10,
            background: C.ink,
          }}
        />
      </div>
    </div>
  );
}
export function MapScreen({ route = 0 }: { route?: number }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: -510,
          top: 0,
          transform: 'scale(.66)',
          transformOrigin: 'top left',
        }}
      >
        <MapArt photo route={route} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 75,
          left: 22,
          right: 22,
          padding: '18px 22px',
          background: '#fffffff5',
          borderRadius: 23,
          fontSize: 23,
          boxShadow: '0 10px 25px #1d1d1f12',
        }}
      >
        ⌕　搜索校园地点
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 73,
          left: 16,
          right: 16,
          padding: 23,
          background: '#fffffff5',
          borderRadius: 29,
          boxShadow: '0 10px 30px #1d1d1f15',
        }}
      >
        <div style={{ fontSize: 29, fontWeight: 600 }}>
          {campus.routes[route].to}
        </div>
        <div style={{ fontSize: 19, color: C.muted, marginTop: 10 }}>
          步行 {campus.routes[route].minutes} 分钟 ·{' '}
          {campus.routes[route].meters} 米
        </div>
        <div
          style={{
            background: C.blue,
            color: 'white',
            padding: 14,
            textAlign: 'center',
            borderRadius: 18,
            marginTop: 18,
            fontSize: 22,
          }}
        >
          开始导航
        </div>
      </div>
      <Tabs />
    </>
  );
}
export function Tabs({ selected = 0 }: { selected?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 22,
        height: 44,
        left: 10,
        right: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: '#f5f5f7ef',
        fontSize: 18,
      }}
    >
      {['地图', '课表', '日程', '我的'].map((s, i) => (
        <span
          key={s}
          style={{ color: i === selected ? C.blue : C.muted, fontWeight: 600 }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
export function Course({
  name = '高等数学',
  room = '致远楼A',
  time = '08:00 — 10:25',
  color = '#d6e1ef',
  width = 560,
}: {
  name?: string;
  room?: string;
  time?: string;
  color?: string;
  width?: number;
}) {
  return (
    <div
      style={{
        width,
        padding: '27px 32px',
        background: color,
        borderRadius: 25,
        borderLeft: `7px solid ${C.blue}`,
      }}
    >
      <div style={{ fontSize: 27, color: '#52616a', marginBottom: 14 }}>
        {time}
      </div>
      <div style={{ fontSize: 43, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 27, marginTop: 17, color: '#52616a' }}>
        {room}　↗
      </div>
    </div>
  );
}
export function Glyph({
  kind,
  size = 90,
  color = C.ink,
}: {
  kind: 'sun' | 'rain' | 'walk' | 'pin' | 'book' | 'check' | 'arrow';
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'sun' ? (
        <>
          <circle cx="50" cy="50" r="20" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} transform={`rotate(${i * 45} 50 50)`} d="M50 5V16" />
          ))}
        </>
      ) : kind === 'rain' ? (
        <>
          <path d="M25 58C-3 52 14 17 37 30C40 1 85 10 81 37C107 40 95 62 80 62H25" />
          <path d="M30 77l-5 13m29-13-5 13m29-13-5 13" />
        </>
      ) : kind === 'walk' ? (
        <>
          <circle cx="56" cy="14" r="8" />
          <path d="M47 39l10-9 12 19 14 4M27 58l11-18 15-5-8 31-15 23m15-23 17 7 7 18" />
        </>
      ) : kind === 'book' ? (
        <path d="M50 28Q28 13 9 22V80Q32 71 50 87Q72 71 91 80V22Q68 13 50 28V87" />
      ) : kind === 'check' ? (
        <path d="M18 49L41 73 84 25" />
      ) : kind === 'arrow' ? (
        <path d="M18 81L79 20M31 20H79V68" />
      ) : (
        <>
          <path d="M50 91S16 55 16 36A34 34 0 0 1 84 36C84 55 50 91 50 91Z" />
          <circle cx="50" cy="35" r="11" />
        </>
      )}
    </svg>
  );
}
