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
  name: '06-options',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{
            position: 'absolute',
            left: 60,
            top: 85,
            opacity: 0.26,
            transformOrigin: 'top left',
          }}
          animate={[{ scale: 0.72 }, { scale: 0.82, x: -100, y: -90 }]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <MapArt />
        </motion.div>
        {['最快', '均衡', '少晒', '避雨', '无障碍'].map((label, i) => (
          <motion.div
            key={label}
            style={{
              position: 'absolute',
              left: 170,
              top: 150 + i * 157,
              width: 1540,
              height: 126,
              display: 'flex',
              alignItems: 'center',
              gap: 50,
            }}
            animate={[
              { x: 1700, opacity: 0 },
              { x: 0, opacity: 1 },
            ]}
            transition={{ duration: 0.65, delay: i * 0.12, ease, fill: 'both' }}
          >
            <div style={{ width: 164, fontSize: 47, fontWeight: 550 }}>
              {label}
            </div>
            <svg width="1030" height="120" viewBox="0 0 1030 120">
              <Ink
                d={
                  [
                    'M10 62H980',
                    'M10 62Q190 15 350 62T670 62T990 62',
                    'M10 62H180Q230 62 230 24H680Q730 24 730 62H990',
                    'M10 62H290V25H720V62H990',
                    'M10 80H240L380 30H620L790 80H990',
                  ][i]!
                }
                color={[C.ink, '#8a9197', C.green, C.blue, '#ac8a74'][i]}
                width={i === 2 ? 13 : 8}
                delay={0.3 + i * 0.12}
                duration={0.75}
              />
            </svg>
            <div style={{ fontSize: 34, color: i === 2 ? C.green : C.muted }}>
              {['距离优先', '舒适兼顾', '建筑阴影', '有顶通道', '避开楼梯'][i]}
            </div>
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
