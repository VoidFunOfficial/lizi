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
  name: '04-search',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{ position: 'absolute', left: 440, top: 190, width: 1040 }}
          animate={[
            {
              scale: 0.45,
              y: 370,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              y: 0,
              offset: 0.2,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              y: 0,
              offset: 0.83,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1.8,
              x: -110,
              y: -110,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <div
            style={{
              height: 126,
              borderRadius: 35,
              background: 'white',
              boxShadow: '0 18px 65px #15202b0b',
              padding: '30px 40px',
              display: 'flex',
              gap: 28,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 68, color: C.muted }}>⌕</span>
            <motion.div
              style={{ overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 49 }}
              animate={[{ width: 0 }, { width: 370 }]}
              transition={{
                duration: 0.65,
                delay: 0.65,
                fill: 'both',
                ease: 'linear',
              }}
            >
              图书馆
            </motion.div>
          </div>
          {['图书馆', '24H还书处', '致远楼A'].map((n, i) => (
            <Reveal
              key={n}
              x={0}
              y={165 + i * 148}
              delay={0.6 + i * 0.12}
              style={{
                width: 1040,
                borderBottom: '1px solid #dcdce0',
                padding: '22px 33px',
                display: 'flex',
                alignItems: 'center',
                gap: 27,
                background: i === 0 ? '#e5edf5' : 'transparent',
                borderRadius: i === 0 ? 28 : 0,
              }}
            >
              <Glyph
                kind={i === 0 ? 'book' : 'pin'}
                size={62}
                color={i === 0 ? C.blue : C.muted}
              />
              <span style={{ fontSize: 44 }}>{n}</span>
              <span
                style={{ marginLeft: 'auto', color: C.muted, fontSize: 34 }}
              >
                ↗
              </span>
            </Reveal>
          ))}
        </motion.div>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M492 423Q876 384 1430 425"
            color={C.blue}
            width={6}
            delay={2.1}
            duration={0.45}
          />
        </svg>
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
