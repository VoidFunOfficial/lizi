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
  name: '13-import',
  schema: {},
  component() {
    return (
      <Frame note="课程及界面为演示内容；支持教务导入和 XLS / XLSX 文件导入。">
        <motion.div
          style={{
            position: 'absolute',
            left: 180,
            top: 205,
            width: 625,
            height: 675,
            background: 'white',
            borderRadius: 32,
            padding: 42,
            boxShadow: '0 25px 70px #18232d0a',
          }}
          animate={[
            { x: -850, rotate: -8 },
            { x: 0, rotate: 0 },
          ]}
          transition={{ duration: 0.7, ease, fill: 'both' }}
        >
          <div style={{ fontSize: 44, marginBottom: 33 }}>教务课表</div>
          {['学号', '密码', '验证码'].map((n, i) => (
            <div
              key={n}
              style={{
                fontSize: 29,
                padding: '23px 24px',
                marginTop: 17,
                borderRadius: 16,
                background: C.paper,
                color: C.muted,
              }}
            >
              {n}
              <span style={{ float: 'right', color: C.ink }}>
                {['演示账号', '••••••••', 'A 7 K 3'][i]}
              </span>
            </div>
          ))}
          <div
            style={{
              background: C.blue,
              borderRadius: 22,
              textAlign: 'center',
              padding: 24,
              color: 'white',
              fontSize: 32,
              marginTop: 31,
            }}
          >
            导入课表
          </div>
          <div
            style={{
              color: C.muted,
              fontSize: 24,
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            也可选择 XLS / XLSX 文件
          </div>
        </motion.div>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M846 529H1032M1003 502L1036 529 1003 555"
            color={C.blue}
            width={7}
            delay={0.8}
            duration={0.45}
          />
        </svg>
        {[
          ['高等数学', '致远楼A', '08:00 — 10:25'],
          ['大学英语', '格物楼A', '10:40 — 12:15'],
          ['线性代数', '致远楼C', '14:00 — 15:35'],
        ].map((a, i) => (
          <motion.div
            key={a[0]}
            style={{ position: 'absolute', left: 1110, top: 150 + i * 257 }}
            animate={[
              { x: -170, y: 0, opacity: 0, scale: 0.7 },
              { x: 0, y: 0, opacity: 1, scale: 1 },
            ]}
            transition={{
              duration: 0.65,
              delay: 1 + i * 0.17,
              ease,
              fill: 'both',
            }}
          >
            <Course
              name={a[0]}
              room={a[1]}
              time={a[2]}
              color={['#d6e1ef', '#e3dbeb', '#d8e4dc'][i]}
            />
          </motion.div>
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
