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
  name: '09-rain',
  schema: {},
  component() {
    return (
      <Frame
        bg="#e5edf3"
        note="有顶通道示意，实际通行以路网标注和开放状态为准。"
      >
        <motion.div
          style={{ position: 'absolute', left: 210, top: 150 }}
          animate={[
            { x: -300, opacity: 0 },
            { x: 0, opacity: 1 },
          ]}
          transition={{ duration: 0.65, ease, fill: 'both' }}
        >
          <Glyph kind="rain" size={230} color="#738da0" />
        </motion.div>
        <svg style={full} viewBox="0 0 1920 1080">
          {Array.from({ length: 17 }, (_, i) => (
            <motion.path
              key={i}
              d={`M${530 + i * 68} 170l-28 82`}
              stroke="#a5bac9"
              strokeWidth={5}
              strokeLinecap="round"
              animate={[
                { y: -70, opacity: 0 },
                { y: 170, opacity: 0.8 },
                { y: 360, opacity: 0 },
              ]}
              transition={{
                duration: 1.1,
                delay: i * 0.055,
                repeat: 2,
                ease: 'linear',
                fill: 'both',
              }}
            />
          ))}
          <motion.g
            animate={[{ y: 650 }, { y: 0 }]}
            transition={{ duration: 0.75, delay: 0.2, ease, fill: 'both' }}
          >
            <path
              d="M480 525L1410 525 1550 610 620 610Z"
              fill="#f7f8f9"
              stroke="#c1c7cb"
              strokeWidth={3}
            />
            <path d="M620 610H1550V637H620Z" fill="#aab5bd" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={`M${670 + i * 200} 637V850`}
                stroke="#b1bec6"
                strokeWidth={20}
              />
            ))}
          </motion.g>
          <Ink
            d="M250 923H550L780 786H1710"
            color={C.blue}
            width={14}
            delay={1}
          />
        </svg>
        <Label x={1460} y={170} size={66} delay={0.4}>
          避雨
        </Label>
        <Label x={1280} y={276} size={36} color="#73828b" delay={0.6}>
          优先室内与有顶路径。
        </Label>
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
