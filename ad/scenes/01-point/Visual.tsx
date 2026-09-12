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
  name: '01-point',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{ position: 'absolute', left: 960, top: 540 }}
          animate={[
            {
              scale: 12,
              rotate: -55,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              rotate: 0,
              offset: 0.23,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              rotate: 0,
              offset: 0.7,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.6,
              x: -190,
              y: 45,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <svg
            width="840"
            height="620"
            viewBox="0 0 840 620"
            style={{ position: 'absolute', left: -420, top: -310 }}
          >
            <Ink
              d="M-220 510C80 510 80 150 270 150S410 430 570 370S700 80 1050 120"
              color={C.blue}
              width={13}
              duration={1.65}
            />
            <Ink
              d="M280 290C280 130 555 110 565 280C565 417 420 494 420 494S280 419 280 290"
              width={9}
              delay={0.7}
              duration={0.9}
            />
          </svg>
          <Dot size={52} />
        </motion.div>
        <Reveal x={1250} y={330} delay={1.5} style={{ fontSize: 39 }}>
          你在这里。
        </Reveal>
        <motion.div
          style={{
            position: 'absolute',
            left: 348,
            top: 180,
            transformOrigin: 'top left',
          }}
          animate={[
            {
              opacity: 0,
              scale: 0.9,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              opacity: 0,
              scale: 0.9,
              offset: 0.72,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              opacity: 1,
              scale: 0.6,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <MapArt />
        </motion.div>
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
