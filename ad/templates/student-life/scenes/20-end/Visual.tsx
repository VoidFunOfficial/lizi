import emblem from '../../../../assets/campus-emblem.png';
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
} from '../../../../components/Kit.tsx';
export default defineReact({
  name: '20-end',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{
            position: 'absolute',
            left: 295,
            top: 350,
            transformOrigin: 'center',
          }}
          animate={[
            { scale: 1.5, x: -50, opacity: 0 },
            { scale: 1, x: 0, opacity: 1 },
          ]}
          transition={{ duration: 0.7, ease, fill: 'both' }}
        >
          <img
            src={emblem}
            style={{ width: 270, height: 270, objectFit: 'contain' }}
          />
        </motion.div>
        <Reveal
          x={620}
          y={362}
          delay={0.25}
          style={{
            fontFamily: 'Mont,SF,sans-serif',
            fontSize: 134,
            fontWeight: 500,
            letterSpacing: '-.065em',
          }}
        >
          NJustMap
        </Reveal>
        <Reveal
          x={627}
          y={549}
          delay={0.55}
          style={{ fontSize: 44, color: C.muted, letterSpacing: '.02em' }}
        >
          南京理工大学 · 江阴校区
        </Reveal>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M625 672C815 651 1280 670 1515 653"
            color={C.blue}
            width={6}
            delay={0.8}
            duration={0.6}
          />
        </svg>
        <motion.div
          style={{ position: 'absolute', left: 1530, top: 655 }}
          animate={[
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1 },
          ]}
          transition={{ duration: 0.4, delay: 1.45, ease, fill: 'both' }}
        >
          <Dot size={23} />
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
