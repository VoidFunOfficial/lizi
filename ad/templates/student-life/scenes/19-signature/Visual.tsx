import strokes from '../../../../assets/signature.json';
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
  name: '19-signature',
  schema: {},
  component() {
    return (
      <Frame>
        <motion.div
          style={full}
          animate={[{ scale: 1.08 }, { scale: 1 }]}
          transition={{ duration: 4, ease: 'linear' }}
        >
          <svg style={full} viewBox="0 0 1920 1080">
            {strokes.map((stroke) => (
              <Ink
                key={stroke.id}
                d={stroke.d}
                width={stroke.width}
                color={stroke.color}
                delay={stroke.at}
                duration={stroke.duration}
              />
            ))}
          </svg>
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
