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
  name: '02-campus',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{
            position: 'absolute',
            left: 348,
            top: 180,
            transformOrigin: 'top left',
          }}
          animate={[
            {
              scale: 0.6,
              rotate: 0,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.78,
              x: -180,
              y: -130,
              rotate: -6,
              offset: 0.28,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.78,
              x: -180,
              y: -130,
              rotate: -6,
              offset: 0.7,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1.12,
              x: -370,
              y: -340,
              rotate: 0,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <MapArt labels />
          <motion.div
            style={full}
            animate={[
              { opacity: 0, offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' },
              { opacity: 0, offset: 0.35, easing: 'cubic-bezier(.22,1,.36,1)' },
              { opacity: 1, offset: 0.62, easing: 'cubic-bezier(.22,1,.36,1)' },
            ]}
            transition={{ duration: 4, ease: 'linear' }}
          >
            <MapArt photo />
          </motion.div>
        </motion.div>
        <Reveal
          x={105}
          y={805}
          delay={0.4}
          style={{ padding: 28, background: C.paper }}
        >
          <div style={{ fontSize: 49 }}>南京理工大学</div>
          <div style={{ fontSize: 31, color: C.muted, marginTop: 15 }}>
            江阴校区
          </div>
        </Reveal>
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
