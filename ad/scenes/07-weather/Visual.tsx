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
  name: '07-weather',
  schema: {},
  component() {
    return (
      <Frame bg="#e7eef2" note="天气数值为演示；实际路线依据可用天气数据计算。">
        <motion.div
          style={{
            position: 'absolute',
            left: 250,
            top: 255,
            transformOrigin: 'top left',
          }}
          animate={[
            {
              rotate: -120,
              scale: 0.3,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              rotate: 0,
              scale: 1,
              offset: 0.25,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              rotate: 45,
              scale: 1,
              offset: 0.78,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              rotate: 0,
              scale: 0.329268,
              x: -90,
              y: -150,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <Glyph kind="sun" size={410} color="#d4a85c" />
        </motion.div>
        <Reveal x={850} y={257} delay={0.3}>
          <div style={{ fontSize: 44 }}>江阴</div>
          <div
            style={{
              fontSize: 245,
              lineHeight: 1.1,
              fontWeight: 500,
              letterSpacing: '-.065em',
            }}
          >
            28°
          </div>
          <div style={{ fontSize: 51, color: '#5c6f7d' }}>晴</div>
        </Reveal>
        <Reveal
          x={1160}
          y={730}
          delay={1.1}
          style={{ fontSize: 40, color: '#5c6f7d' }}
        >
          出发时刻的天气，也在路线里。
        </Reveal>
        <svg style={full} viewBox="0 0 1920 1080">
          <Ink
            d="M585 795Q810 882 1084 778M1055 755L1096 775 1079 811"
            color={C.blue}
            width={6}
            delay={1.6}
          />
        </svg>
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
