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
  name: '11-live',
  schema: {},
  component() {
    const track = campus.routes[4].points;
    return (
      <Frame note="定位与路径变化为功能演示。">
        <motion.div
          style={{
            position: 'absolute',
            left: 30,
            top: -130,
            transformOrigin: 'center',
          }}
          animate={[
            {
              scale: 0.95,
              x: 0,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.95,
              x: -200,
              offset: 0.2,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.95,
              x: -200,
              offset: 0.65,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.76,
              x: -140,
              y: 80,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <MapArt route={1} />
          <svg style={full} viewBox="0 0 2038 1279">
            <Ink
              d={campus.routes[4].path}
              color={C.green}
              width={11}
              delay={1.25}
              duration={0.65}
            />
          </svg>
          <motion.div
            style={{
              position: 'absolute',
              left: track[0][0],
              top: track[0][1],
            }}
            animate={track.map((p, i) => ({
              x: p[0] - track[0][0],
              y: p[1] - track[0][1],
              offset: i / (track.length - 1),
            }))}
            transition={{ duration: 3, ease: 'linear' }}
          >
            <div
              style={{
                position: 'absolute',
                left: -65,
                top: -65,
                width: 130,
                height: 130,
                borderRadius: '50%',
                background: '#3475ba20',
              }}
            />
            <Dot size={38} />
            <motion.div
              style={{
                position: 'absolute',
                left: -40,
                top: -110,
                width: 80,
                height: 95,
                clipPath: 'polygon(50% 100%,0 0,100% 0)',
                background: 'linear-gradient(#3475ba00,#3475ba65)',
                transformOrigin: '40px 110px',
              }}
              animate={[{ rotate: 35 }, { rotate: 95 }, { rotate: 55 }]}
              transition={{ duration: 3, ease }}
            />
          </motion.div>
        </motion.div>
        <Reveal
          x={1300}
          y={245}
          delay={0.5}
          style={{
            width: 450,
            background: '#f5f5f7f0',
            padding: 38,
            borderRadius: 32,
          }}
        >
          <div style={{ fontSize: 46 }}>路线随你更新。</div>
          <div
            style={{
              fontSize: 32,
              color: C.muted,
              marginTop: 25,
              lineHeight: 1.5,
            }}
          >
            位置在变化。 目的地，一直在。
          </div>
        </Reveal>
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
