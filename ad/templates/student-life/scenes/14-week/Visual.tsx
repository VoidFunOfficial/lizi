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
  name: '14-week',
  schema: {},
  component() {
    return (
      <Frame note="示例课表 · 2026–2027 夏季 / 秋季学期">
        <motion.div
          style={{
            position: 'absolute',
            left: 170,
            top: 95,
            width: 1580,
            transformOrigin: 'center top',
          }}
          animate={[
            {
              x: 850,
              rotate: 10,
              scale: 0.8,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: 0,
              scale: 1,
              offset: 0.2,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 0,
              rotate: 0,
              scale: 1,
              offset: 0.75,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              x: 480,
              y: -60,
              rotate: 0,
              scale: 1.65,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 38,
              marginBottom: 48,
            }}
          >
            <span style={{ fontSize: 80, fontWeight: 600 }}>第 4 周</span>
            <span style={{ fontSize: 32, color: C.muted }}>
              9 月 14 日 — 20 日
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 49 }}>‹　›</span>
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            {['一', '二', '三', '四', '五', '六', '日'].map((n, i) => (
              <div key={n} style={{ width: 210 }}>
                <div
                  style={{
                    padding: 19,
                    textAlign: 'center',
                    fontSize: 34,
                    color: i === 0 ? 'white' : C.muted,
                    background: i === 0 ? C.blue : 'transparent',
                    borderRadius: 25,
                  }}
                >
                  周{n}
                  <div style={{ fontSize: 53, marginTop: 12 }}>{14 + i}</div>
                </div>
                {[0, 1, 2].map((j) => (
                  <motion.div
                    key={j}
                    style={{
                      height: 135,
                      marginTop: 18,
                      padding: 17,
                      borderRadius: 20,
                      background:
                        (i + j) % 4 === 0
                          ? '#d6e1ef'
                          : (i + j) % 4 === 1
                            ? '#e3dbeb'
                            : (i + j) % 4 === 2
                              ? '#d8e4dc'
                              : '#eaeaec',
                      fontSize: 27,
                    }}
                    animate={[
                      { scaleY: 0, opacity: 0 },
                      { scaleY: 1, opacity: 1 },
                    ]}
                    transition={{
                      duration: 0.5,
                      delay: 0.35 + i * 0.06 + j * 0.1,
                      ease,
                      fill: 'both',
                    }}
                  >
                    {(i + j) % 4 !== 3
                      ? ['高等数学', '大学英语', '线性代数'][(i + j) % 3]
                      : ''}
                    {(i + j) % 4 !== 3 && (
                      <div
                        style={{
                          fontSize: 20,
                          color: '#6c747a',
                          marginTop: 17,
                        }}
                      >
                        {['致远楼A', '格物楼A', '致远楼C'][(i + j) % 3]}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
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
