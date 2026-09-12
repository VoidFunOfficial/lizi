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
  name: '18-together',
  schema: {},
  component() {
    return (
      <Frame bg={C.navy}>
        <motion.div
          style={{ position: 'absolute', left: 170, top: 110 }}
          animate={[
            {
              x: -650,
              rotate: -18,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: -8,
              offset: 0.25,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: -8,
              offset: 0.77,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 600,
              y: 40,
              rotate: 0,
              scale: 0.7,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Phone scale={0.94}>
            <MapScreen />
          </Phone>
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: 738, top: 55 }}
          animate={[
            { y: 1200, offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' },
            { y: 0, offset: 0.25, easing: 'cubic-bezier(.22,1,.36,1)' },
            { y: 0, offset: 0.77, easing: 'cubic-bezier(.22,1,.36,1)' },
            {
              y: 80,
              scale: 0.7,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Phone>
            <div style={{ padding: '85px 24px' }}>
              <div style={{ fontSize: 41, fontWeight: 600 }}>周一</div>
              <div
                style={{
                  fontSize: 23,
                  color: C.muted,
                  marginTop: 12,
                  marginBottom: 28,
                }}
              >
                第 4 周 · 9 月 14 日
              </div>
              <Course width={350} />
              <div style={{ marginTop: 22 }}>
                <Course
                  width={350}
                  name="线性代数"
                  room="致远楼C"
                  time="14:00 — 15:35"
                  color="#d8e4dc"
                />
              </div>
            </div>
            <Tabs selected={1} />
          </Phone>
        </motion.div>
        <motion.div
          style={{ position: 'absolute', left: 1320, top: 110 }}
          animate={[
            {
              x: 650,
              rotate: 18,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: 8,
              offset: 0.25,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: 8,
              offset: 0.77,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: -580,
              y: 40,
              rotate: 0,
              scale: 0.7,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Phone scale={0.94}>
            <div style={{ padding: '85px 28px' }}>
              <div style={{ fontSize: 41, fontWeight: 600 }}>今天</div>
              {[
                '08:00　高等数学',
                '12:20　午餐',
                '14:00　线性代数',
                '17:00　体育场',
              ].map((n, i) => (
                <div
                  key={n}
                  style={{
                    borderLeft: '3px solid #c8dace',
                    padding: '29px 15px',
                    fontSize: 27,
                    marginTop: 20,
                  }}
                >
                  <span style={{ color: C.green }}>●　</span>
                  {n}
                </div>
              ))}
            </div>
            <Tabs selected={2} />
          </Phone>
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
