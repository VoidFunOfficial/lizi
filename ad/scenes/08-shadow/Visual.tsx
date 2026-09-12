/** @jsxRuntime classic */
/** @jsx React.createElement */
import { React } from '@fourier-video/sdk';
import { defineReact } from '@fourier-video/sdk';
import {
  Frame,
  Reveal,
  Label,
  Ink,
  Dot,
  Pin,
  MapArt,
  Phone,
  MapScreen,
  Tabs,
  Course,
  Glyph,
  motion,
  campus,
  C,
  ease,
  full,
} from '../../components/Kit.tsx';
export default defineReact({
  name: '08-shadow',
  schema: {},
  component() {
    return (
      <Frame note="建筑与阴影为原理示意；晴天且天气可用时参与路线计算。">
        <div style={{ position: 'absolute', left: 160, top: 105 }}>
          <Glyph kind="sun" size={135} color="#d4a85c" />
        </div>
        <svg style={full} viewBox="0 0 1920 1080">
          <path d="M420 755L985 435 1575 760 1010 1000Z" fill="#e7e8e5" />
          <motion.path
            d="M720 640L994 483 1370 695 1096 850Z"
            fill="#9aa7a3"
            animate={[
              { x: 0, y: 0, opacity: 0 },
              { x: 125, y: 85, opacity: 0.6 },
            ]}
            transition={{ duration: 1.2, delay: 0.45, ease, fill: 'both' }}
          />
          <motion.g
            animate={[
              { y: -450, opacity: 0 },
              { y: 0, opacity: 1 },
            ]}
            transition={{ duration: 0.85, ease, fill: 'both' }}
          >
            <path d="M710 465L985 310 1260 465 985 625Z" fill="#e0e2df" />
            <path d="M710 465V677L985 835V625Z" fill="#b7bdb8" />
            <path d="M985 625L1260 465V675L985 835Z" fill="#8e9992" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path
                key={i}
                d={`M${1014 + i * 38} ${624 - i * 22}v110`}
                stroke="#dee6e1"
                strokeWidth="12"
              />
            ))}
          </motion.g>
          <Ink
            d="M560 839L709 923Q744 941 780 921L1310 620"
            color={C.green}
            width={15}
            delay={1.3}
          />
          <Ink
            d="M267 254L647 447M256 305L612 483"
            color="#c5ab78"
            width={4}
            delay={0.5}
          />
        </svg>
        <Label x={1320} y={300} size={66} delay={0.65}>
          少晒
        </Label>
        <Label x={1323} y={390} size={36} color={C.muted} delay={0.9}>
          沿建筑阴影，走。
        </Label>
      </Frame>
    );
  },
  designPreview() {
    return {
      props: {},
      composition: { width: 1920, height: 1080, durationSeconds: 4 },
    };
  },
});
