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
  name: '03-pocket',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{
            position: 'absolute',
            left: 738,
            top: 92,
            transformOrigin: '222px 448px',
          }}
          animate={[
            {
              scale: 3.1,
              rotate: 0,
              y: 360,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              rotate: -8,
              y: 0,
              offset: 0.34,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              rotate: 5,
              y: 0,
              offset: 0.76,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1.1,
              rotate: 0,
              y: 25,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Phone>
            <MapScreen />
          </Phone>
        </motion.div>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M555 770C388 760 381 443 546 374M519 350L555 370 526 399"
            color={C.muted}
            width={5}
            delay={1.3}
          />
          <Ink
            d="M1360 353C1512 363 1534 665 1383 733M1404 704L1372 738 1418 745"
            color={C.muted}
            width={5}
            delay={1.5}
          />
        </svg>
        <Label x={210} y={560} size={45} delay={1.2}>
          整座校园。
        </Label>
        <Label x={1330} y={560} size={45} delay={1.4}>
          随身展开。
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
