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
  name: '12-places',
  schema: {},
  component() {
    return (
      <Frame>
        {['图书馆', '樱花苑食堂', '体育场', '学生服务中心'].map((n, i) => {
          const p = campus.places.find((p) => p.name === n)!;
          return (
            <motion.div
              key={n}
              style={{
                position: 'absolute',
                left: 110 + i * 435,
                top: 200,
                width: 395,
                height: 650,
                overflow: 'hidden',
                background: '#e8ebe8',
                borderRadius: 35,
              }}
              animate={[
                {
                  y: 750,
                  rotate: 8,
                  offset: 0,
                  easing: 'cubic-bezier(.22,1,.36,1)',
                },
                {
                  y: 0,
                  rotate: 0,
                  offset: 0.25,
                  easing: 'cubic-bezier(.22,1,.36,1)',
                },
                {
                  y: 0,
                  rotate: 0,
                  offset: 0.75,
                  easing: 'cubic-bezier(.22,1,.36,1)',
                },
                {
                  y: -1100,
                  rotate: -4,
                  offset: 1,
                  easing: 'cubic-bezier(.22,1,.36,1)',
                },
              ]}
              transition={{
                duration: 4,
                delay: i * 0.07,
                ease: 'linear',
                fill: 'both',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 198 - p.x * 0.85,
                  top: 290 - p.y * 0.85,
                  transform: 'scale(.85)',
                  transformOrigin: 'top left',
                }}
              >
                <MapArt photo />
              </div>
              <Pin x={198} y={290} delay={0.55 + i * 0.13} />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  padding: '28px 24px',
                  background: '#fffffff0',
                  width: '100%',
                  fontSize: 39,
                }}
              >
                {n}
                <div style={{ fontSize: 27, color: C.muted, marginTop: 15 }}>
                  {['去自习', '去吃饭', '去运动', '去办事'][i]}　↗
                </div>
              </div>
            </motion.div>
          );
        })}
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
