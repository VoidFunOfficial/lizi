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
  name: '05-route',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={{
            position: 'absolute',
            left: 110,
            top: -150,
            transformOrigin: 'center',
          }}
          animate={[
            {
              scale: 1.1,
              x: 0,
              y: 0,
              offset: 0,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.9,
              x: -80,
              y: 40,
              offset: 0.3,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.9,
              x: -80,
              y: 40,
              offset: 0.76,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
            {
              scale: 0.72,
              x: -230,
              y: 170,
              offset: 1,
              easing: 'cubic-bezier(.22,1,.36,1)',
            },
          ]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <MapArt route={0} draw />
          {[campus.routes[0].from, campus.routes[0].to].map((n) => {
            const p = campus.places.find((p) => p.name === n)!;
            return <Pin key={n} x={p.x} y={p.y} name={n} delay={0.35} />;
          })}
        </motion.div>
        <Reveal
          x={1300}
          y={360}
          delay={0.7}
          style={{ background: '#f5f5f7ed', padding: 44, borderRadius: 35 }}
        >
          <div style={{ fontSize: 42 }}>步行到图书馆</div>
          <div style={{ marginTop: 30, fontSize: 120, fontWeight: 600 }}>
            {campus.routes[0].minutes}
            <span style={{ fontSize: 38 }}> 分钟</span>
          </div>
          <div style={{ fontSize: 35, color: C.muted, marginTop: 15 }}>
            {campus.routes[0].meters} 米
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
