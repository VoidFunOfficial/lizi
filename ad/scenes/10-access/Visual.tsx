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
  name: '10-access',
  schema: {},
  component() {
    return (
      <Frame>
        <Label x={190} y={170} size={67} delay={0.25}>
          无障碍
        </Label>
        <Label x={190} y={270} size={37} color={C.muted} delay={0.5}>
          避开楼梯，连接坡道与电梯。
        </Label>
        <svg style={full} viewBox="0 0 1920 1080">
          <motion.g
            animate={[
              { y: 400, opacity: 0 },
              { y: 0, opacity: 1 },
            ]}
            transition={{ duration: 0.7, ease, fill: 'both' }}
          >
            <path
              d="M370 840H580V760H730V680H880V600H1030V520H1600"
              fill="none"
              stroke="#dadcde"
              strokeWidth={38}
            />
            <path
              d="M310 880H520L1220 480H1630"
              fill="none"
              stroke="#d0d9d3"
              strokeWidth={55}
              strokeLinejoin="round"
            />
            <Ink
              d="M310 880H520L1220 480H1630"
              color={C.green}
              width={13}
              delay={0.5}
              duration={1.2}
            />
          </motion.g>
          <motion.g
            animate={[
              { x: 0, y: 0, offset: 0, easing: 'cubic-bezier(.22,1,.36,1)' },
              { x: 0, y: 0, offset: 0.25, easing: 'cubic-bezier(.22,1,.36,1)' },
              {
                x: 160,
                y: 0,
                offset: 0.36,
                easing: 'cubic-bezier(.22,1,.36,1)',
              },
              {
                x: 860,
                y: -400,
                offset: 0.85,
                easing: 'cubic-bezier(.22,1,.36,1)',
              },
              {
                x: 1110,
                y: -400,
                offset: 1,
                easing: 'cubic-bezier(.22,1,.36,1)',
              },
            ]}
            transition={{ duration: 4, ease: 'linear' }}
          >
            <circle
              cx="390"
              cy="790"
              r="31"
              fill={C.paper}
              stroke={C.green}
              strokeWidth={7}
            />
            <circle cx="400" cy="720" r="13" fill={C.green} />
            <path
              d="M400 744V778H437L461 814M400 753H430"
              fill="none"
              stroke={C.green}
              strokeWidth={7}
            />
          </motion.g>
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
