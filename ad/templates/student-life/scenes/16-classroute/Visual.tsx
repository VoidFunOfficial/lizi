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
  name: '16-classroute',
  schema: {},
  component() {
    return (
      <Frame note="课程为示例；地图路线来自项目内置路网。">
        <motion.div
          style={{
            position: 'absolute',
            left: 200,
            top: 360,
            transformOrigin: 'top left',
          }}
          animate={[
            {
              scale: 1.5,
              x: 0,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              x: 0,
              offset: 0.3,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 1,
              x: 0,
              offset: 0.78,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.7,
              x: -650,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Course />
        </motion.div>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M813 526H1000M975 502L1004 527 975 552"
            color={C.blue}
            width={7}
            delay={0.8}
            duration={0.45}
          />
        </svg>
        <motion.div
          style={{
            position: 'absolute',
            left: 1070,
            top: 100,
            width: 670,
            height: 850,
            overflow: 'hidden',
            borderRadius: 42,
          }}
          animate={[
            { x: 850, rotate: 12 },
            { x: 0, rotate: 0 },
          ]}
          transition={{ duration: 0.8, delay: 0.35, ease, fill: 'both' }}
        >
          <div
            style={{
              position: 'absolute',
              left: -560,
              top: -150,
              transform: 'scale(.9)',
              transformOrigin: 'top left',
            }}
          >
            <MapArt route={1} draw />
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              right: 24,
              padding: 28,
              background: '#ffffffed',
              borderRadius: 25,
              fontSize: 39,
            }}
          >
            致远楼A
            <div style={{ fontSize: 29, color: C.muted, marginTop: 13 }}>
              从图书馆步行 {campus.routes[1].minutes} 分钟
            </div>
          </div>
        </motion.div>
        <Label x={206} y={720} size={39} color={C.muted} delay={1.1}>
          点课程地点，接着走。
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
