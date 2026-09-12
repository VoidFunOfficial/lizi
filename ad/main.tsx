/** @jsxRuntime classic */
/** @jsx React.createElement */
import { React } from '@fourier-video/sdk';
import {
  Canvas,
  Audio,
  defineProject,
  Project,
  Scene,
  Timeline,
  Template,
} from '@fourier-video/sdk/project';
import { SHOTS } from './shots.ts';
export default defineProject(
  <Project id="njustmap-film" version="1.0" audioSampleRate={48000}>
    <Canvas
      width={1920}
      height={1080}
      fps={60}
      background="#f5f5f7"
      colorSpace="sRGB"
    />
    <Timeline>
      {SHOTS.slice(0, 10).map((s, i) => (
        <Scene
          key={s.id}
          id={`shot-${s.id}`}
          {...(i === 0 ? { at: '0f' } : { after: `shot-${SHOTS[i - 1]!.id}` })}
          src={`scenes/${s.id}`}
          audio={false}
        />
      ))}
      <Template
        id="student-life"
        after="shot-10-access"
        src="templates/student-life"
        audio={false}
      />
      <Audio
        id="motion-sfx"
        at="0f"
        duration="4800f"
        src="assets/audio/sfx-master.wav"
        sourceIn="0f"
        volume={1}
      />
    </Timeline>
  </Project>,
);
