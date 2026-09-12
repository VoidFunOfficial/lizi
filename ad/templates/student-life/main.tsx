/** @jsxRuntime classic */
/** @jsx React.createElement */
import { React } from '@fourier-video/sdk';
import {
  Canvas,
  defineTemplate,
  Project,
  Scene,
  Timeline,
} from '@fourier-video/sdk/project';
export default defineTemplate({
  schema: {},
  render: () => (
    <Project id="njust-student-life" version="1.0" audioSampleRate={48000}>
      <Canvas
        width={1920}
        height={1080}
        fps={60}
        background="#f5f5f7"
        colorSpace="sRGB"
      />
      <Timeline>
        <Scene id="shot-11-live" at="0f" src="scenes/11-live" audio={false} />
        <Scene
          id="shot-12-places"
          after="shot-11-live"
          src="scenes/12-places"
          audio={false}
        />
        <Scene
          id="shot-13-import"
          after="shot-12-places"
          src="scenes/13-import"
          audio={false}
        />
        <Scene
          id="shot-14-week"
          after="shot-13-import"
          src="scenes/14-week"
          audio={false}
        />
        <Scene
          id="shot-15-day"
          after="shot-14-week"
          src="scenes/15-day"
          audio={false}
        />
        <Scene
          id="shot-16-classroute"
          after="shot-15-day"
          src="scenes/16-classroute"
          audio={false}
        />
        <Scene
          id="shot-17-plan"
          after="shot-16-classroute"
          src="scenes/17-plan"
          audio={false}
        />
        <Scene
          id="shot-18-together"
          after="shot-17-plan"
          src="scenes/18-together"
          audio={false}
        />
        <Scene
          id="shot-19-signature"
          after="shot-18-together"
          src="scenes/19-signature"
          audio={false}
        />
        <Scene
          id="shot-20-end"
          after="shot-19-signature"
          src="scenes/20-end"
          audio={false}
        />
      </Timeline>
    </Project>
  ),
});
