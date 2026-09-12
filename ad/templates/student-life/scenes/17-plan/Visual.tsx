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
  name: '17-plan',
  schema: {},
  component() {
    return (
      <Frame note="日程与时间为演示；具体计划按你的课程和地点生成。">
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M245 370H630Q720 370 720 470V620Q720 720 830 720H1560"
            color={C.blue}
            width={9}
            delay={0.25}
            duration={1.8}
          />
        </svg>
        {[
          {
            x: 215,
            y: 370,
            time: '08:00',
            name: '高等数学',
            sub: '致远楼A',
            kind: 'book',
          },
          {
            x: 610,
            y: 370,
            time: '12:20',
            name: '午餐',
            sub: '樱花苑食堂',
            kind: 'pin',
          },
          {
            x: 985,
            y: 720,
            time: '14:00',
            name: '线性代数',
            sub: '致远楼C',
            kind: 'book',
          },
          {
            x: 1535,
            y: 720,
            time: '17:00',
            name: '运动',
            sub: '体育场',
            kind: 'walk',
          },
        ].map((p, i) => (
          <Reveal key={p.name} x={p.x} y={p.y} delay={0.3 + i * 0.25}>
            <Dot size={30} />
            <div style={{ position: 'absolute', top: -170, left: -58 }}>
              <Glyph
                kind={p.kind as 'book'}
                size={95}
                color={i === 3 ? C.green : C.blue}
              />
            </div>
            <div
              style={{ position: 'absolute', top: 42, left: -60, width: 285 }}
            >
              <div style={{ fontSize: 42, color: C.muted }}>{p.time}</div>
              <div style={{ fontSize: 52, marginTop: 18 }}>{p.name}</div>
              <div style={{ fontSize: 32, color: C.muted, marginTop: 15 }}>
                {p.sub}
              </div>
            </div>
          </Reveal>
        ))}
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
