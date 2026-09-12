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
  name: '15-day',
  schema: {},
  component() {
    return (
      <Frame note="示例课表；每日保留全部 13 小节，空课时段也可见。">
        <Label x={160} y={195} size={64} delay={0.3}>
          周一
        </Label>
        <Reveal x={155} y={300} delay={0.5}>
          <div style={{ fontSize: 230, fontWeight: 500, lineHeight: 1 }}>
            13
          </div>
          <div style={{ fontSize: 40, color: C.muted }}>小节，逐一展开。</div>
        </Reveal>
        <motion.div
          style={{ position: 'absolute', left: 690, top: 90, width: 1070 }}
          animate={[
            { y: 0, offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' },
            { y: 0, offset: 0.27, easing: 'cubic-bezier(.22,1,.36,1)' },
            { y: -380, offset: 0.64, easing: 'cubic-bezier(.22,1,.36,1)' },
            { y: -690, offset: 1, easing: 'cubic-bezier(.22,1,.36,1)' },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          {[
            '08:00',
            '08:50',
            '09:40',
            '10:40',
            '11:30',
            '14:00',
            '14:50',
            '15:50',
            '16:40',
            '17:30',
            '19:00',
            '19:50',
            '20:40',
          ].map((t, i) => (
            <div
              key={t}
              style={{
                height: 115,
                borderTop: '1px solid #d5d7db',
                display: 'flex',
                alignItems: 'center',
                gap: 30,
              }}
            >
              <span style={{ fontSize: 29, width: 62, color: C.muted }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 35, width: 160 }}>{t}</span>
              <div
                style={{
                  fontSize: 32,
                  background:
                    i < 3
                      ? '#d6e1ef'
                      : i < 5
                        ? '#e3dbeb'
                        : i === 5 || i === 6
                          ? '#d8e4dc'
                          : 'transparent',
                  borderRadius: 17,
                  padding: '18px 27px',
                  width: 740,
                  color: i < 7 ? C.ink : C.muted,
                }}
              >
                {i < 3
                  ? '高等数学 · 致远楼A'
                  : i < 5
                    ? '大学英语 · 格物楼A'
                    : i === 5 || i === 6
                      ? '线性代数 · 致远楼C'
                      : '空课'}
              </div>
            </div>
          ))}
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
